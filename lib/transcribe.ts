// lib/transcribe.ts
// Transcreve um áudio via OpenAI Whisper e salva no banco
// Compartilhado entre o handler automático e o endpoint manual

import { query } from "./db"
import { emit } from "./sse-manager"

export async function transcribeAudio(
  messageId: string,
  jid: string,
  instance: string
): Promise<{ ok: true; transcricao: string } | { ok: false; error: string }> {
  const EVOLUTION_URL = process.env.EVOLUTION_URL!
  const EVOLUTION_KEY = process.env.EVOLUTION_KEY!
  const OPENAI_KEY    = process.env.OPENAI_API_KEY

  if (!OPENAI_KEY) return { ok: false, error: "OPENAI_API_KEY não configurada" }

  // 1. Busca o raw da mensagem no banco para montar o objeto completo
  //    (necessário para áudios mais antigos fora do cache da Evolution)
  let rawMessage: Record<string, unknown> | null = null
  try {
    const [row] = await query<{ raw: Record<string, unknown> }>(
      `SELECT raw FROM lab.messages WHERE id = $1 LIMIT 1`,
      [messageId]
    )
    rawMessage = row?.raw ?? null
  } catch { /* silencioso — tenta só com o key.id */ }

  // 2. Baixa o áudio como base64 da Evolution API
  let base64: string
  let mimetype: string
  try {
    // Se tiver o raw completo, usa o message object para permitir re-download
    // de áudios antigos que não estão mais no cache da Evolution
    const messageBody = rawMessage?.message
      ? { key: (rawMessage.key ?? { id: messageId }), message: rawMessage.message }
      : { key: { id: messageId } }

    const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ message: messageBody, convertToMp4: false }),
    })
    const data = await res.json() as { base64?: string; mimetype?: string; response?: { message?: string[] } }
    if (!data.base64) {
      const detail = data.response?.message?.[0] ?? ""
      const expired = detail.includes("mmg.whatsapp.net") || detail.includes("fetch stream")
      throw new Error(expired
        ? "Áudio expirado — o WhatsApp remove mídias do CDN após ~14 dias"
        : "base64 ausente na resposta da Evolution"
      )
    }
    base64   = data.base64
    mimetype = data.mimetype ?? "audio/ogg"
  } catch (err) {
    return { ok: false, error: `Download falhou: ${err}` }
  }

  // 2. Envia para OpenAI Whisper
  let transcricao: string
  try {
    const buffer   = Buffer.from(base64, "base64")
    const ext      = mimetype.includes("mp4") ? "mp4" : mimetype.includes("mpeg") ? "mp3" : "ogg"
    const form     = new FormData()
    form.append("file", new Blob([buffer], { type: mimetype }), `audio.${ext}`)
    form.append("model", "whisper-1")
    form.append("language", "pt")

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    })

    if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
    const data = await res.json() as { text?: string }
    transcricao = data.text?.trim() ?? ""
  } catch (err) {
    return { ok: false, error: `Whisper falhou: ${err}` }
  }

  if (!transcricao) return { ok: false, error: "transcrição vazia" }

  // 3. Salva no banco
  await query(`UPDATE lab.messages SET content = $1 WHERE id = $2`, [transcricao, messageId])
    .catch(console.error)

  // 4. Notifica o frontend via SSE
  emit(jid, "message_update", { id: messageId, content: transcricao })

  console.log(`[transcribe] ${messageId}: "${transcricao.slice(0, 80)}..."`)
  return { ok: true, transcricao }
}
