// app/api/agenda/categorias/route.ts
import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET() {
  const { rows } = await pool.query(
    "SELECT id, nome, cor, icone FROM lab.evento_categorias ORDER BY nome"
  )
  return NextResponse.json(rows)
}