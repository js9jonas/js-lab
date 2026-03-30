// app/api/lab/logs/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { WebhookLog } from "@/lib/types"

export const dynamic = "force-dynamic"

type LogRowFull = WebhookLog & { raw_payload: unknown }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit  = Math.min(Number(searchParams.get("limit")  ?? 100), 200)
  const kind   = searchParams.get("kind")     // filtro opcional
  const since  = searchParams.get("since")    // ISO — retorna só mais novos que esse
  const withPayload = searchParams.get("payload") === "1"

  try {
    const conditions: string[] = []
    const params: unknown[]    = [limit]

    if (kind)  { conditions.push(`kind = $${params.length + 1}`)        ; params.push(kind) }
    if (since) { conditions.push(`received_at > $${params.length + 1}`) ; params.push(since) }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : ""
    const cols  = withPayload
      ? "id, received_at, instance, from_jid, message_type, kind, confidence, handler_action, success, detail, raw_payload"
      : "id, received_at, instance, from_jid, message_type, kind, confidence, handler_action, success, detail"

    const rows = await query<LogRowFull>(
      `SELECT ${cols} FROM lab.webhook_logs ${where} ORDER BY received_at DESC LIMIT $1`,
      params
    )

    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
