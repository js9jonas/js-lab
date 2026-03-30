// app/api/webhook/route.ts
// Recebe todos os eventos da Evolution API
// Configurar no Evolution: POST https://js-lab.seudominio.com/api/webhook

import { NextRequest, NextResponse } from "next/server"
import type { EvolutionPayload } from "@/lib/types"
import { classify, extractText } from "@/lib/classifier"
import { dispatch } from "@/lib/dispatcher"
import { getMediaUrl } from "@/lib/evolution"
import { logWebhook } from "@/lib/db"

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
