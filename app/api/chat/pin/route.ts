import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

// Garante que a coluna existe (migração inline)
async function ensureColumn() {
  await query(`
    ALTER TABLE lab.conversations
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE
  `)
}

// PATCH /api/chat/pin  { jid, pinned: true|false }
export async function PATCH(req: NextRequest) {
  await ensureColumn()
  const { jid, pinned } = await req.json() as { jid: string; pinned: boolean }
  if (!jid) return NextResponse.json({ error: "jid obrigatório" }, { status: 400 })
  await query(
    `UPDATE lab.conversations SET pinned = $1 WHERE jid = $2`,
    [pinned, jid]
  )
  return NextResponse.json({ ok: true })
}
