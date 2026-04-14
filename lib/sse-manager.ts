// lib/sse-manager.ts
// Map global de conexões SSE por JID.
// Usa globalThis para sobreviver à re-avaliação de módulos no Next.js dev mode.

type Controller = ReadableStreamDefaultController<Uint8Array>

const g = globalThis as typeof globalThis & {
  __sseConnections?: Map<string, Set<Controller>>
}
if (!g.__sseConnections) g.__sseConnections = new Map()
const connections = g.__sseConnections

const encoder = new TextEncoder()

function send(ctrl: Controller, event: string, data: unknown) {
  try {
    ctrl.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  } catch { /* conexão já fechada */ }
}

export function addConnection(jid: string, ctrl: Controller) {
  if (!connections.has(jid)) connections.set(jid, new Set())
  connections.get(jid)!.add(ctrl)
}

export function removeConnection(jid: string, ctrl: Controller) {
  connections.get(jid)?.delete(ctrl)
  if (connections.get(jid)?.size === 0) connections.delete(jid)
}

/** Envia evento apenas para quem está na conversa `jid`. */
export function emit(jid: string, event: string, data: unknown) {
  connections.get(jid)?.forEach(ctrl => send(ctrl, event, data))
}

/** Envia evento para TODOS os clientes conectados (qualquer jid). */
export function emitGlobal(event: string, data: unknown) {
  connections.forEach(set => set.forEach(ctrl => send(ctrl, event, data)))
}
