// app/api/agenda/lemas/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET(req: NextRequest) {
  const ano = req.nextUrl.searchParams.get("ano") ?? new Date().getFullYear()
  const { rows } = await pool.query(
    "SELECT id, ano, mes, lema FROM lab.lemas_mensais WHERE ano = $1 ORDER BY mes",
    [Number(ano)]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { ano, mes, lema } = await req.json()
  const { rows } = await pool.query(
    `INSERT INTO lab.lemas_mensais (ano, mes, lema)
     VALUES ($1, $2, $3)
     ON CONFLICT (ano, mes) DO UPDATE SET lema = EXCLUDED.lema
     RETURNING id`,
    [ano, mes, lema]
  )
  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}