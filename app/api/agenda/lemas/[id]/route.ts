// app/api/agenda/lemas/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { lema } = await req.json()
  await pool.query("UPDATE lab.lemas_mensais SET lema = $1 WHERE id = $2", [lema, params.id])
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await pool.query("DELETE FROM lab.lemas_mensais WHERE id = $1", [params.id])
  return NextResponse.json({ ok: true })
}