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

// Labels de um chat (WhatsApp Business) — implementado via Z-API
export interface WaLabel {
  id: string
  name: string
  color: number
}

const ZAPI_BASE = () => (process.env.ZAPI_BASE_URL ?? "").replace(/\/$/, "")
const ZAPI_TOKEN = () => process.env.ZAPI_CLIENT_TOKEN ?? ""

async function zapiFetch(path: string, method: "GET" | "PUT" = "GET"): Promise<unknown> {
  const res = await fetch(`${ZAPI_BASE()}${path}`, {
    method,
    headers: { "Client-Token": ZAPI_TOKEN() },
  })
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function findLabels(_instance: string): Promise<WaLabel[]> {
  const data = await zapiFetch("/tags")
  return Array.isArray(data) ? (data as WaLabel[]) : []
}

export async function handleLabel(
  _instance: string,
  phone: string,
  labelId: string,
  action: "add" | "remove"
): Promise<void> {
  await zapiFetch(`/chats/${phone}/tags/${labelId}/${action}`, "PUT")
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
