// lib/dispatcher.ts
// Recebe o resultado da classificação e chama o handler correto
// Ponto central de extensão: para adicionar um novo handler, basta registrar aqui

import type { EvolutionPayload, ClassificationResult, HandlerResult } from "./types"
import { handleComando } from "./handlers/comando"
import { handleAudio } from "./handlers/audio"

export async function dispatch(
  payload: EvolutionPayload,
  classification: ClassificationResult,
  dryRun = false
): Promise<HandlerResult> {
  const { kind, confidence } = classification

  // Confiança baixa: loga mas não age (evita falsos positivos)
  if (confidence === "baixa") {
    console.log(`[dispatcher] confiança baixa para "${kind}" — ignorando`)
    return { success: true, action: "ignorado_baixa_confianca", detail: kind }
  }

  switch (kind) {
    case "comprovante_pix":
      console.log("[dispatcher] comprovante_pix — handler desativado")
      return { success: true, action: "comprovante_pix_desativado" }

    case "comando":
      return handleComando(payload, dryRun)

    case "audio":
      return handleAudio(payload)

    case "texto_livre":
      // Handler futuro: agente IA
      console.log("[dispatcher] texto livre — sem handler ativo")
      return { success: true, action: "texto_livre_sem_handler" }

    case "ignorar":
    default:
      return { success: true, action: "ignorado", detail: String(classification.meta?.reason ?? "") }
  }
}
