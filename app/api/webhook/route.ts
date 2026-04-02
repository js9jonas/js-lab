// app/api/webhook/route.ts
// Recebe todos os eventos da Evolution API
// Configurar no Evolution: POST https://js-lab.seudominio.com/api/webhook

import { NextRequest, NextResponse } from "next/server"
import type { EvolutionPayload } from "@/lib/types"
import { classify, extractText } from "@/lib/classifier"
import { dispatch } from "@/lib/dispatcher"
import { getMediaUrl } from "@/lib/evolution"
import { logWebhook, query } from "@/lib/db"

// Persiste mensagem recebida nas tabelas do chat
async function persistChatMessage(payload: EvolutionPayload) {
  const jid     = payload.data?.key?.remoteJid
  const msgId   = payload.data?.key?.id
  const fromMe  = payload.data?.key?.fromMe ?? false
  const msgType = payload.data?.messageType ?? "conversation"
  const ts      = payload.data?.messageTimestamp
    ? new Date(Number(payload.data.messageTimestamp) * 1000)
    : new Date()

  if (!jid || !msgId) return

  const content = extractText(payload) || null
  const instance = payload.instance

  const pushName = payload.data?.pushName ?? null

  // Upsert na conversa
  await query(`
    INSERT INTO lab.conversations (jid, instance, profile_name, last_message, last_message_at, unread_count)
    VALUES ($1, $2, $3, $4, $5, 1)
    ON CONFLICT (jid) DO UPDATE SET
      profile_name    = COALESCE($3, lab.conversations.profile_name),
      last_message    = $4,
      last_message_at = $5,
      unread_count    = CASE WHEN $6 THEN 0 ELSE lab.conversations.unread_count + 1 END,
      updated_at      = NOW()
  `, [jid, instance, pushName, content, ts, fromMe])

  // Insere mensagem
  await query(`
    INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, status, timestamp, raw)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (id) DO NOTHING
  `, [
    msgId, jid, instance, fromMe, msgType, content,
    fromMe ? "SENT" : "RECEIVED",
    ts,
    JSON.stringify(payload.data),
  ])
}

// Verificação de segurança via header secret
function verifySecret(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true // sem secret configurado = aberto (só dev)
  return req.headers.get("x-webhook-secret") === secret
}

export async function POST(req: NextRequest) {
  // 1. Segurança
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: EvolutionPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // 2. Filtra apenas eventos de mensagem (ignora presence, connection etc)
  if (payload.event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: payload.event })
  }

  console.log(`[webhook] ${payload.event} | instance=${payload.instance} | type=${payload.data?.messageType}`)

  // 3. Se for imagem, baixa a URL de mídia antes de classificar
  if (payload.data?.messageType === "imageMessage") {
    const mediaUrl = await getMediaUrl(payload.instance, payload.data.key.id)
    if (mediaUrl) payload.data.mediaUrl = mediaUrl
    // Repassa o caption para o texto da mensagem se existir
    const img = payload.data.message?.imageMessage as { caption?: string } | undefined
    if (img?.caption) payload.data.caption = img.caption
  }

  // 4. Classifica
  const classification = classify(payload)
  console.log(`[webhook] classificado: ${classification.kind} (${classification.confidence})`)

  // 5. Despacha para o handler
  const result = await dispatch(payload, classification)
  console.log(`[webhook] resultado: ${result.action} | success=${result.success}`)

  // 6. Persiste log no banco (não bloqueia a resposta)
  logWebhook({
    received_at: new Date(),
    instance: payload.instance,
    from_jid: payload.data?.key?.remoteJid ?? "",
    message_type: payload.data?.messageType ?? "",
    kind: classification.kind,
    confidence: classification.confidence,
    handler_action: result.action,
    success: result.success,
    detail: result.detail ?? result.error,
    raw_payload: payload,
  }).catch(console.error)

  // 7. Persiste mensagem nas tabelas do chat
  persistChatMessage(payload).catch(console.error)

  return NextResponse.json({ ok: true, ...result })
}

// Rota GET para verificar se o webhook está de pé (útil no Easypanel)
export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "js-lab webhook",
    timestamp: new Date().toISOString(),
  })
}
