// app/api/chat/sse/route.ts
import { NextRequest } from "next/server"
import { addConnection, removeConnection } from "@/lib/sse-manager"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function send(ctrl: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  try {
    ctrl.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  } catch { /* conexão já fechada */ }
}

export async function GET(req: NextRequest) {
  const jid = new URL(req.url).searchParams.get("jid") ?? "*"

  let ctrl: ReadableStreamDefaultController<Uint8Array>
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
      addConnection(jid, ctrl)

      // Flush imediato: força o Next.js a enviar os headers HTTP agora
      ctrl.enqueue(encoder.encode(": connected\n\n"))

      req.signal.addEventListener("abort", () => {
        closed = true
        removeConnection(jid, ctrl)
        try { ctrl.close() } catch {}
      })

      // DB polling: garante entrega mesmo em ambientes multi-processo (EasyPanel)
      // O sse-manager ainda funciona para entrega instantânea quando bate no mesmo processo
      let lastCheck = new Date()
      let ticks = 0

      async function poll() {
        if (closed) return

        try {
          if (jid === "*") {
            // Conversas atualizadas desde o último check
            const updated = await query<{
              jid: string
              last_message: string | null
              last_message_at: string
              unread_count: number
            }>(`
              SELECT jid, last_message, last_message_at::text, unread_count
              FROM lab.conversations
              WHERE updated_at > $1
            `, [lastCheck])

            for (const c of updated) {
              send(ctrl, "conversation_update", {
                jid:             c.jid,
                last_message:    c.last_message,
                last_message_at: c.last_message_at,
                unread_count:    c.unread_count,  // valor absoluto — frontend usa quando presente
              })
            }
          } else {
            // Novas mensagens para o JID específico
            const msgs = await query<{
              id: string; jid: string; from_me: boolean; message_type: string
              content: string | null; media_url: string | null; status: string
              timestamp: string; raw: Record<string, unknown> | null
            }>(`
              SELECT id, jid, from_me, message_type, content, media_url, status,
                     timestamp::text, raw
              FROM lab.messages
              WHERE jid = $1 AND timestamp > $2
              ORDER BY timestamp ASC
            `, [jid, lastCheck])

            for (const msg of msgs) {
              send(ctrl, "new_message", msg)
            }
          }
        } catch { /* erro de DB — silencioso, próximo tick vai tentar de novo */ }

        lastCheck = new Date()
        ticks++

        // heartbeat a cada ~27s (9 ticks × 3s)
        if (ticks % 9 === 0) {
          send(ctrl, "ping", {})
        }

        if (!closed) setTimeout(poll, 3_000)
      }

      setTimeout(poll, 3_000)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
