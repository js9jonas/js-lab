// app/api/webhook/route.ts
// Recebe todos os eventos da Evolution API
// Configurar no Evolution: POST https://js-lab.seudominio.com/api/webhook

import { NextRequest, NextResponse } from "next/server"
import type { EvolutionPayload } from "@/lib/types"
import { classify, extractText } from "@/lib/classifier"
import { dispatch } from "@/lib/dispatcher"
import { getMediaUrl } from "@/lib/evolution"
import { logWebhook, query } from "@/lib/db"
import { emit, emitGlobal } from "@/lib/sse-manager"

// Persiste mensagem recebida nas tabelas do chat
async function persistChatMessage(payload: EvolutionPayload) {
  let jid        = payload.data?.key?.remoteJid
  const msgId   = payload.data?.key?.id
  const fromMe  = payload.data?.key?.fromMe ?? false
  const msgType = payload.data?.messageType ?? "conversation"
  const ts      = payload.data?.messageTimestamp
    ? new Date(Number(payload.data.messageTimestamp) * 1000)
    : new Date()

  if (!jid || !msgId) return

  const content = extractText(payload) || null
  const instance = payload.instance

  // @lid: identificador de dispositivo sem número real — tenta resolver para conversa existente
  if (jid.endsWith("@lid")) {
    const rawName = payload.data?.pushName
    if (rawName) {
      const found = await query<{ jid: string }>(
        `SELECT jid FROM lab.conversations
         WHERE profile_name = $1 AND instance = $2 AND jid LIKE '%@s.whatsapp.net'
         LIMIT 1`,
        [rawName, instance]
      )
      if (found.length === 1) {
        jid = found[0].jid  // redireciona mensagem para conversa existente
      } else {
        return  // não conseguiu resolver com segurança, ignora
      }
    } else {
      return  // sem pushName para tentar resolver, ignora
    }
  }

  // Para grupos, pushName é o nome do membro — não usar como profile_name do grupo
  const isGroup  = jid?.endsWith("@g.us") ?? false
  const pushName = (!fromMe && !isGroup && payload.data?.pushName) ? payload.data.pushName : null

  // URL do CDN do WhatsApp (pequena string, expira em horas — base64 fica no raw)
  const imgMsg = payload.data?.message?.imageMessage as { url?: string } | undefined
  const mediaUrl = imgMsg?.url ?? null

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
    INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, media_url, status, timestamp, raw)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (id) DO NOTHING
  `, [
    msgId, jid, instance, fromMe, msgType, content,
    mediaUrl,
    fromMe ? "SENT" : "RECEIVED",
    ts,
    JSON.stringify(payload.data),
  ])

  // Emite eventos SSE para clientes conectados
  emit(jid, "new_message", {
    id: msgId, jid, from_me: fromMe, message_type: msgType,
    content, media_url: mediaUrl,
    status: fromMe ? "SENT" : "RECEIVED",
    timestamp: ts.toISOString(),
    raw: payload.data,
  })
  emitGlobal("conversation_update", {
    jid,
    last_message:       content,
    last_message_at:    ts.toISOString(),
    unread_count_delta: fromMe ? 0 : 1,
  })
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

  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // 2. Atualização de status (DELIVERED / READ) — trata antes de converter para EvolutionPayload
  if (raw.event === "messages.update") {
    const dataArr = Array.isArray(raw.data) ? raw.data : [raw.data]
    for (const upd of dataArr) {
      const item = upd as { key?: { id?: string; remoteJid?: string }; update?: { status?: string } }
      const msgId    = item?.key?.id
      const jid      = item?.key?.remoteJid
      const rawStatus = item?.update?.status

      const statusMap: Record<string, string> = {
        SERVER_ACK:   "SENT",
        DELIVERY_ACK: "DELIVERED",
        READ:         "READ",
        PLAYED:       "READ",
      }
      const status = rawStatus ? (statusMap[rawStatus] ?? rawStatus) : null

      if (msgId && status) {
        await query(
          `UPDATE lab.messages SET status = $1 WHERE id = $2`,
          [status, msgId]
        ).catch(console.error)

        if (jid) {
          emit(jid, "message_status", { id: msgId, status })
        }
      }
    }
    return NextResponse.json({ ok: true, action: "status_updated" })
  }

  const payload = raw as unknown as EvolutionPayload

  // 2b. Filtra apenas eventos de mensagem (ignora presence, connection etc)
  if (payload.event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: payload.event })
  }

  // 2b. Reação — persiste e retorna (não passa pelo dispatcher)
  if (payload.data?.messageType === "reactionMessage") {
    const reaction = payload.data?.message?.reactionMessage as
      { key?: { id?: string; fromMe?: boolean }; text?: string } | undefined
    const targetId  = reaction?.key?.id
    const emoji     = reaction?.text ?? ""
    const reactorJid = payload.data?.key?.remoteJid ?? "unknown"
    const fromMe     = payload.data?.key?.fromMe ?? false
    const reactorKey = fromMe ? "me" : reactorJid

    if (targetId) {
      await query(`
        UPDATE lab.messages
        SET reactions = COALESCE(reactions, '{}'::jsonb) || jsonb_build_object($1::text, $2::text)
        WHERE id = $3
      `, [reactorKey, emoji, targetId]).catch(console.error)
    }
    return NextResponse.json({ ok: true, action: "reaction_persisted" })
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