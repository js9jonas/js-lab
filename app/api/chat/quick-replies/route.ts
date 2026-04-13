import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

// Garante que a tabela existe
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS lab.quick_replies (
      id         SERIAL PRIMARY KEY,
      instance   TEXT NOT NULL,
      keyword    TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (instance, keyword)
    )
  `)
}

// GET  /api/chat/quick-replies?instance=xxx
export async function GET(req: NextRequest) {
  await ensureTable()
  const instance = new URL(req.url).searchParams.get("instance") ?? ""
  const rows = await query<{ id: number; instance: string; keyword: string; message: string }>(
    `SELECT id, instance, keyword, message FROM lab.quick_replies WHERE instance = $1 ORDER BY keyword ASC`,
    [instance]
  )
  return NextResponse.json({ quickReplies: rows })
}

// POST /api/chat/quick-replies  { instance, keyword, message }
export async function POST(req: NextRequest) {
  await ensureTable()
  const { instance, keyword, message } =
    await req.json() as { instance: string; keyword: string; message: string }

  if (!instance || !keyword || !message)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const clean = keyword.replace(/^\//, "").trim().toLowerCase()

  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO lab.quick_replies (instance, keyword, message)
       VALUES ($1, $2, $3)
       ON CONFLICT (instance, keyword) DO UPDATE SET message = EXCLUDED.message
       RETURNING id`,
      [instance, clean, message]
    )
    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/chat/quick-replies?id=123
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
  await query(`DELETE FROM lab.quick_replies WHERE id = $1`, [Number(id)])
  return NextResponse.json({ ok: true })
}

// PATCH /api/chat/quick-replies  { id, keyword, message }
export async function PATCH(req: NextRequest) {
  const { id, keyword, message } =
    await req.json() as { id: number; keyword: string; message: string }

  if (!id || !keyword || !message)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const clean = keyword.replace(/^\//, "").trim().toLowerCase()
  await query(
    `UPDATE lab.quick_replies SET keyword = $1, message = $2 WHERE id = $3`,
    [clean, message, id]
  )
  return NextResponse.json({ ok: true })
}
