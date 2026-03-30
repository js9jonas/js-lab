// lib/handlers/comprovante-pix.ts
// Recebe uma imagem de comprovante, extrai dados via OCR e responde ao remetente

import type { EvolutionPayload, HandlerResult } from "../types"
import { sendText } from "../evolution"

// Extrai valor e remetente do texto OCR usando regex
function parseOCR(text: string): { valor: string | null; remetente: string | null } {
  // Exemplos: "R$ 45,00" / "R$45.00" / "R$ 1.200,00"
  const valorMatch = text.match(/R\$\s*([\d.,]+)/i)
  const valor = valorMatch ? `R$ ${valorMatch[1]}` : null

  // Exemplos: "Pagador: João Silva" / "Nome: João Silva"
  const remetMatch = text.match(/(?:pagador|nome|remetente)[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?: [A-ZÀ-Ú][a-zà-ú]+)+)/i)
  const remetente = remetMatch ? remetMatch[1] : null

  return { valor, remetente }
}

// Baixa a imagem do WhatsApp e envia para o OCR.space
async function runOCR(mediaUrl: string): Promise<string> {
  const key = process.env.OCR_SPACE_KEY ?? "helloworld" // key gratuita para teste

  const formData = new FormData()
  formData.append("url", mediaUrl)
  formData.append("language", "por")
  formData.append("isOverlayRequired", "false")
  formData.append("OCREngine", "2")

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: key },
    body: formData,
  })

  const data = await res.json() as {
    ParsedResults?: { ParsedText: string }[]
    IsErroredOnProcessing?: boolean
    ErrorMessage?: string
  }

  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage ?? "Erro no OCR")
  }

  return data.ParsedResults?.[0]?.ParsedText ?? ""
}

export async function handleComprovantePix(
  payload: EvolutionPayload,
  dryRun = false
): Promise<HandlerResult> {
  const jid = payload.data.key.remoteJid
  const instance = payload.instance
  const mediaUrl = payload.data.mediaUrl

  // Sem URL de mídia (só caption) — responde pedindo o comprovante
  if (!mediaUrl) {
    if (!dryRun) {
      await sendText(instance, jid,
        "Recebi sua mensagem sobre pagamento! 📄\n\n" +
        "Por favor, envie a *imagem do comprovante* para eu registrar."
      )
    }
    return { success: true, action: "solicitou_comprovante", detail: "sem imagem" }
  }

  // Tenta fazer OCR
  let ocrText = ""
  try {
    ocrText = await runOCR(mediaUrl)
  } catch (err) {
    if (!dryRun) {
      await sendText(instance, jid,
        "Recebi o comprovante, mas não consegui ler os dados automaticamente. " +
        "Nossa equipe vai confirmar em breve. ✅"
      )
    }
    return { success: false, action: "ocr_falhou", error: String(err) }
  }

  const { valor, remetente } = parseOCR(ocrText)

  // Monta a resposta
  const linhas = [
    "✅ *Comprovante recebido!*",
    "",
    valor ? `💰 Valor: *${valor}*` : "💰 Valor: (não identificado)",
    remetente ? `👤 Nome: ${remetente}` : "",
    "",
    "Vou registrar e confirmar em breve.",
  ].filter(Boolean)

  if (!dryRun) {
    await sendText(instance, jid, linhas.join("\n"))
  }

  return {
    success: true,
    action: "comprovante_processado",
    detail: `valor=${valor ?? "?"}, remetente=${remetente ?? "?"}`,
  }
}
