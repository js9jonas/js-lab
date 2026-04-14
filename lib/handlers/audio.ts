// lib/handlers/audio.ts
// Baixa o áudio da Evolution API, transcreve via OpenAI Whisper e salva no banco

import type { EvolutionPayload, HandlerResult } from "../types"
import { query } from "../db"
import { emit } from "../sse-manager"

export async function handleAudio(payload: EvolutionPayload): Promise<HandlerResult> {
  const instance  = payload.instance
  const msgId     = payload.data?.key?.id
  const jid       = payload.data?.key?.remoteJid

  if (!msgId || !jid) {
    return { success: false, action: "audio_transcricao", error: "msgId ou jid ausente" }
  }

  const EVOLUTION_URL = process.env.EVOLUTION_URL!
  const EVOLUTION_KEY = process.env.EVOLUTION_KEY!
  const OPENAI_KEY    = process.env.OPENAI_API_KEY

  if (!OPENAI_KEY) {
    return { success: false, action: "audio_transcricao", error: "OPENAI_API_KEY não configurada" }
  }

  // 1. Baixa o áudio como base64 da Evolution API
  let base64: string
  let mimetype: string
  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ message: { key: { id: msgId } }, convertToMp4: false }),
    })
    const data = await res.json() as { base64?: string; mimetype?: string }
    if (!data.base64) throw new Error("base64 ausente na resposta")
    base64   = data.base64
    mimetype = data.mimetype ?? "audio/ogg"
  } catch (err) {
    return { success: false, action: "audio_transcricao", error: `Download falhou: ${err}` }
  }

  // 2. Converte base64 → Blob e envia para Whisper
  let transcricao: string
  try {
    const buffer   = Buffer.from(base64, "base64")
    const ext      = mimetype.includes("mp4") ? "mp4" : mimetype.includes("mpeg") ? "mp3" : "ogg"
    const filename = `audio.${ext}`

    const form = new FormData()
    form.append("file", new Blob([buffer], { type: mimetype }), filename)
    form.append("model", "whisper-1")
    form.append("language", "pt")

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Whisper ${res.status}: ${err}`)
    }

    const data = await res.json() as { text?: string }
    transcricao = data.text?.trim() ?? ""
  } catch (err) {
    return { success: false, action: "audio_transcricao", error: `Whisper falhou: ${err}` }
  }

  if (!transcricao) {
    return { success: true, action: "audio_transcricao", detail: "transcrição vazia" }
  }

  // 3. Salva transcrição no banco (atualiza a mensagem existente)
  await query(
    `UPDATE lab.messages SET content = $1 WHERE id = $2`,
    [transcricao, msgId]
  ).catch(console.error)

  console.log(`[audio] transcrição salva para ${msgId}: "${transcricao.slice(0, 80)}..."`)

  // 4. Notifica o frontend via SSE para atualizar a bolha de áudio em tempo real
  emit(jid, "message_update", { id: msgId, content: transcricao })

  return {
    success: true,
    action:  "audio_transcricao",
    detail:  transcricao,
  }
}
