// app/api/chat/messages/[jid]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface MessageRow {
  id: string
  jid: string
  from_me: boolean
  message_type: string
  content: string | null
  media_url: string | null
  status: string | null
  timestamp: string
}

type RouteContext = { params: Promise<{ jid: string }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { jid } = await ctx.params
  const decoded = decodeURIComponent(jid)
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50)

  try {
    // 1. Tenta buscar do banco local
    const local = await query<MessageRow>(`
      SELECT id, jid, from_me, message_type, content, media_url, status,
             timestamp::text
      FROM lab.messages
      WHERE jid = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [decoded, limit])

    if (local.length >= 10) {
      return NextResponse.json({ source: "local", messages: local.reverse() })
    }

    // 2. Fallback: busca na Evolution API
    const EVOLUTION_URL = process.env.EVOLUTION_URL!
    const EVOLUTION_KEY = process.env.EVOLUTION_KEY!
    const INSTANCE     = process.env.EVOLUTION_INSTANCE ?? "jsevolution"

    const res = await fetch(
      `${EVOLUTION_URL}/chat/findMessages/${INSTANCE}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
        body: JSON.stringify({
          where: { key: { remoteJid: decoded } },
          limit,
        }),
      }
    )

    const data = await res.json() as {
      messages?: { records?: unknown[] }
      records?: unknown[]
    }

    const records = data?.messages?.records ?? data?.records ?? []

    // Normaliza para o formato da interface
    const messages: MessageRow[] = records
      .map((r: unknown) => {
        const rec = r as Record<string, unknown>
        const key = rec.key as Record<string, unknown> | undefined
        const msg = rec.message as Record<string, unknown> | undefined
        const ts  = rec.messageTimestamp

        const content =
          (msg?.conversation as string) ??
          ((msg?.extendedTextMessage as Record<string,unknown>)?.text as string) ??
          ((msg?.imageMessage as Record<string,unknown>)?.caption as string) ??
          null

        return {
          id:           (key?.id as string) ?? String(Math.random()),
          jid:          decoded,
          from_me:      (key?.fromMe as boolean) ?? false,
          message_type: (rec.messageType as string) ?? "conversation",
          content,
          media_url:    null,
          status:       (rec.status as string) ?? null,
          timestamp:    ts
            ? new Date(Number(ts) * 1000).toISOString()
            : new Date().toISOString(),
        }
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Persiste localmente para próximas buscas
    if (messages.length > 0) {
      for (const m of messages) {
        await query(`
          INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, media_url, status, timestamp, raw)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (id) DO NOTHING
        `, [
          m.id, decoded,
          process.env.EVOLUTION_INSTANCE ?? "jsevolution",
          m.from_me, m.message_type, m.content,
          m.media_url, m.status,
          m.timestamp,
          JSON.stringify(r),
        ]).catch(() => { /* ignora conflito */ })
      }
    }

    return NextResponse.json({ source: "evolution", messages })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
