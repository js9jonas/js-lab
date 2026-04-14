// app/api/chat/sse/route.ts
import { NextRequest } from "next/server"
import { addConnection, removeConnection } from "@/lib/sse-manager"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const jid = new URL(req.url).searchParams.get("jid") ?? "*"

  let ctrl: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
      addConnection(jid, ctrl)

      // heartbeat a cada 30s para manter conexão viva no Nginx/proxy
      const heartbeat = setInterval(() => {
        try {
          ctrl.enqueue(new TextEncoder().encode("event: ping\ndata: {}\n\n"))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        removeConnection(jid, ctrl)
        try { ctrl.close() } catch {}
      })
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
