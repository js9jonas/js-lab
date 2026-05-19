import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { RifaOrganizacao } from "@/app/rifas/types"

export async function GET() {
  try {
    const rows = await query<RifaOrganizacao>(
      `SELECT * FROM lab.rifa_organizacoes ORDER BY nome`
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nome, subtitulo, endereco, cidade, telefone, logo_url } = body
    if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 })
    const [row] = await query<RifaOrganizacao>(
      `INSERT INTO lab.rifa_organizacoes (nome, subtitulo, endereco, cidade, telefone, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nome.trim(), subtitulo || null, endereco || null, cidade || null, telefone || null, logo_url || null]
    )
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
