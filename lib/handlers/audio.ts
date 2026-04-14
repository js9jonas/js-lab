// lib/handlers/audio.ts
import type { EvolutionPayload, HandlerResult } from "../types"
import { transcribeAudio } from "../transcribe"

export async function handleAudio(payload: EvolutionPayload): Promise<HandlerResult> {
  const instance = payload.instance
  const msgId    = payload.data?.key?.id
  const jid      = payload.data?.key?.remoteJid

  if (!msgId || !jid) {
    return { success: false, action: "audio_transcricao", error: "msgId ou jid ausente" }
  }

  const result = await transcribeAudio(msgId, jid, instance)

  return result.ok
    ? { success: true,  action: "audio_transcricao", detail: result.transcricao }
    : { success: false, action: "audio_transcricao", error: result.error }
}
