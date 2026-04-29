// lib/evolution.ts
// Funções para chamar a Evolution API (envio de mensagens, download de mídia)
// Usado pelos handlers — nunca chame a API diretamente nos handlers

const EVOLUTION_URL = (process.env.EVOLUTION_URL ?? "").replace(/\/$/, "")
const EVOLUTION_KEY = process.env.EVOLUTION_KEY!

async function evolutionFetch(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API ${res.status}: ${err}`)
  }

  return res.json()
}

// Envia texto simples para um JID
export async function sendText(
  instance: string,
  jid: string,
  text: string
): Promise<void> {
  await evolutionFetch(`/message/sendText/${instance}`, "POST", {
    number: jid,
    text,
  })
}

// Baixa a mídia de uma mensagem e retorna a URL temporária
export async function getMediaUrl(
  instance: string,
  messageId: string
): Promise<string | null> {
  try {
    const data = await evolutionFetch(
      `/chat/getBase64FromMediaMessage/${instance}`,
      "POST",
      { message: { key: { id: messageId } }, convertToMp4: false }
    ) as { base64?: string; mimetype?: string }

    if (!data.base64) return null

    // Retorna como data URL (suficiente para OCR.space e Claude API)
    return `data:${data.mimetype ?? "image/jpeg"};base64,${data.base64}`
  } catch {
    return null
  }
}

// Labels de um chat (WhatsApp Business)
export interface WaLabel {
  id: string
  name: string
  color: number
}

export async function findLabels(instance: string): Promise<WaLabel[]> {
  const data = await evolutionFetch(`/label/findLabels/${instance}`)
  return Array.isArray(data) ? (data as WaLabel[]) : []
}

export async function handleLabel(
  instance: string,
  jid: string,
  labelId: string,
  action: "add" | "remove"
): Promise<void> {
  await evolutionFetch(`/label/handleLabel/${instance}`, "PUT", {
    number: jid,
    labelId,
    action,
  })
}

// Lista instâncias
export async function fetchInstances(): Promise<unknown[]> {
  const data = await evolutionFetch("/instance/fetchInstances")
  return Array.isArray(data) ? data : []
}

// Estado de conexão de uma instância
export async function getConnectionState(instance: string): Promise<string> {
  const data = await evolutionFetch(`/instance/connectionState/${instance}`) as {
    instance?: { state?: string }
  }
  return data?.instance?.state ?? "unknown"
}
