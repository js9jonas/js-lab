// app/api/agentes/[id]/modulos/[moduloId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string; moduloId: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { moduloId } = await ctx.params
  const body = await req.json() as Partial<{
    nome: string; descricao: string; gatilhos: string[]
    conteudo: string; ordem: number; ativo: boolean
  }>

  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (body.nome      !== undefined) { sets.push(`nome = $${i++}`);      vals.push(body.nome) }
  if (body.descricao !== undefined) { sets.push(`descricao = $${i++}`); vals.push(body.descricao) }
  if (body.gatilhos  !== undefined) { sets.push(`gatilhos = $${i++}`);  vals.push(body.gatilhos) }
  if (body.conteudo  !== undefined) { sets.push(`conteudo = $${i++}`);  vals.push(body.conteudo) }
  if (body.ordem     !== undefined) { sets.push(`ordem = $${i++}`);     vals.push(body.ordem) }
  if (body.ativo     !== undefined) { sets.push(`ativo = $${i++}`);     vals.push(body.ativo) }

  if (sets.length === 0) return NextResponse.json({ ok: true })

  vals.push(moduloId)
  try {
    await query(`UPDATE lab.agente_modulos SET ${sets.join(", ")} WHERE id = $${i}`, vals)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { moduloId } = await ctx.params
  await query(`DELETE FROM lab.agente_modulos WHERE id = $1`, [moduloId])
  return NextResponse.json({ ok: true })
}
