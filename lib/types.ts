// lib/types.ts
// Payload normalizado da Evolution API (messages.upsert)
export interface EvolutionPayload {
  event: string
  instance: string
  data: {
    key: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message: Record<string, unknown>
    messageType: string
    messageTimestamp: number
    pushName?: string
    mediaUrl?: string   // preenchido após download de mídia
    caption?: string    // extraído de imageMessage/videoMessage
  }
  date_time: string
  server_url: string
  apikey?: string
}

// Resultado da classificação
export type MessageKind =
  | "comprovante_pix"
  | "comando"
  | "texto_livre"
  | "audio"
  | "ignorar"

export interface ClassificationResult {
  kind: MessageKind
  confidence: "alta" | "media" | "baixa"
  meta: Record<string, string | number | boolean>
}

// Resultado de execução de um handler
export interface HandlerResult {
  success: boolean
  action: string
  detail?: string
  error?: string
}

// Entrada do simulador (POST /api/lab/simulate)
export interface SimulateInput {
  payload: Partial<EvolutionPayload>
  dryRun?: boolean // true = não envia mensagem de volta
}

// Log persistido no banco
export interface WebhookLog {
  id?: number
  received_at: Date
  instance: string
  from_jid: string
  message_type: string
  kind: MessageKind
  confidence: string
  handler_action: string
  success: boolean
  detail?: string
  raw_payload: unknown
}
