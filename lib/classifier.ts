// lib/classifier.ts
// Classifica uma mensagem recebida da Evolution API
// Regras em cascata: mais específica primeiro, fallback no final
// Fácil de estender: adiciona um bloco "if" ou move pra IA quando precisar

import type { EvolutionPayload, ClassificationResult, MessageKind } from "./types"

// ----------------------------------------------------------------
// Padrões regex para classificação rápida (sem IA, custo zero)
// ----------------------------------------------------------------

const PATTERNS: Record<MessageKind, RegExp[]> = {
  comprovante_pix: [
    /comprovante/i,
    /pix/i,
    /pagamento/i,
    /transferência/i,
    /recibo/i,
    /r\$\s*[\d,.]+/i, // "R$ 45,00" ou "R$45"
  ],
  comando: [
    /^\/\w+/,         // começa com /
  ],
  texto_livre: [],    // fallback de texto
  audio: [],          // detectado pelo messageType
  ignorar: [],        // fallback final
}

// ----------------------------------------------------------------
// Extrai o texto principal de um payload da Evolution API
// ----------------------------------------------------------------

export function extractText(payload: EvolutionPayload): string {
  const msg = payload.data?.message ?? {}

  // Texto simples
  if (typeof msg.conversation === "string") return msg.conversation

  // Texto estendido (com preview de link etc)
  const ext = msg.extendedTextMessage as { text?: string } | undefined
  if (ext?.text) return ext.text

  // Caption de imagem/vídeo
  const img = msg.imageMessage as { caption?: string } | undefined
  if (img?.caption) return img.caption

  const vid = msg.videoMessage as { caption?: string } | undefined
  if (vid?.caption) return vid.caption

  // Áudio
  const aud = msg.audioMessage
  if (aud) return "__audio__"

  // Sticker, documento etc
  const doc = msg.documentMessage as { fileName?: string } | undefined
  if (doc) return `__documento__:${doc.fileName ?? ""}`

  return ""
}

// ----------------------------------------------------------------
// Classificador principal
// ----------------------------------------------------------------

export function classify(payload: EvolutionPayload): ClassificationResult {
  const msgType = payload.data?.messageType ?? ""
  const text = extractText(payload)
  const isFromMe = payload.data?.key?.fromMe ?? false

  // Mensagens próprias são ignoradas (evita loop)
  if (isFromMe) {
    return { kind: "ignorar", confidence: "alta", meta: { reason: "fromMe" } }
  }

  // Áudio sem transcrição — handler futuro
  if (msgType === "audioMessage") {
    return { kind: "audio", confidence: "alta", meta: { msgType } }
  }

  // Comandos por prefixo
  for (const regex of PATTERNS.comando) {
    if (regex.test(text.trim())) {
      const comando = text.trim().split(/\s+/)[0]
      return {
        kind: "comando",
        confidence: "alta",
        meta: { comando, text },
      }
    }
  }

  // Comprovante: imagem com caption suspeito OU qualquer texto suspeito
  const isImage = msgType === "imageMessage"
  let pixScore = 0
  for (const regex of PATTERNS.comprovante_pix) {
    if (regex.test(text)) pixScore++
  }

  if (isImage && pixScore >= 1) {
    return {
      kind: "comprovante_pix",
      confidence: "alta",
      meta: { pixScore, hasImage: true, caption: text },
    }
  }
  if (!isImage && pixScore >= 2) {
    return {
      kind: "comprovante_pix",
      confidence: "media",
      meta: { pixScore, hasImage: false, text },
    }
  }
  if (!isImage && pixScore === 1) {
    return {
      kind: "comprovante_pix",
      confidence: "baixa",
      meta: { pixScore, hasImage: false, text },
    }
  }

  // Qualquer texto restante
  if (text && text !== "__audio__" && !text.startsWith("__documento__")) {
    return {
      kind: "texto_livre",
      confidence: "alta",
      meta: { text },
    }
  }

  // Tudo que não encaixou
  return {
    kind: "ignorar",
    confidence: "alta",
    meta: { msgType, reason: "sem_handler" },
  }
}
