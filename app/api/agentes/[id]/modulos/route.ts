// app/api/agentes/[id]/modulos/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

export interface ModuloRow {
  id: number
  agente_id: number
  nome: string
  descricao: string | null
  gatilhos: string[]
  conteudo: string
  ordem: number
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const rows = await query<ModuloRow>(
      `SELECT * FROM lab.agente_modulos
       WHERE agente_id = $1
       ORDER BY ordem ASC, id ASC`, [id]
    )
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const { nome, descricao, gatilhos, conteudo, ordem } = await req.json() as {
    nome: string
    descricao?: string
    gatilhos?: string[]
    conteudo: string
    ordem?: number
  }

  try {
    const [row] = await query<{ id: number }>(
      `INSERT INTO lab.agente_modulos (agente_id, nome, descricao, gatilhos, conteudo, ordem)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [id, nome, descricao ?? null, gatilhos ?? [], conteudo, ordem ?? 0]
    )
    return NextResponse.json({ ok: true, id: row.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
