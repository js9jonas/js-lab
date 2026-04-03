// app/api/agentes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  try {
    const [agente] = await query<{
      id: number; nome: string; descricao: string | null
      prompt_base: string; prompt_atual: string; ativo: boolean
      criado_em: string; atualizado_em: string
    }>(`SELECT * FROM lab.agentes WHERE id = $1`, [id])

    if (!agente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

    const instancias = await query<{ instance: string; ativo: boolean }>(
      `SELECT instance, ativo FROM lab.agente_instancias WHERE agente_id = $1 ORDER BY instance`, [id]
    )

    const versoes = await query<{ versao: number; motivo: string | null; criado_em: string }>(
      `SELECT versao, motivo, criado_em::text FROM lab.agente_prompt_versoes
       WHERE agente_id = $1 ORDER BY versao DESC LIMIT 10`, [id]
    )

    const aprendizados = await query<{
      id: number; jid: string; sugestao_ia: string; resposta_real: string
      incorporado: boolean; criado_em: string
    }>(
      `SELECT id, jid, sugestao_ia, resposta_real, incorporado, criado_em::text
       FROM lab.agente_aprendizados WHERE agente_id = $1
       ORDER BY criado_em DESC LIMIT 50`, [id]
    )

    return NextResponse.json({ ...agente, instancias, versoes, aprendizados })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json() as {
    nome?: string; descricao?: string; ativo?: boolean; instancias?: string[]
  }

  try {
    if (body.nome !== undefined || body.descricao !== undefined || body.ativo !== undefined) {
      const sets: string[] = []
      const vals: unknown[] = []
      let i = 1
      if (body.nome !== undefined)      { sets.push(`nome = $${i++}`);      vals.push(body.nome) }
      if (body.descricao !== undefined)  { sets.push(`descricao = $${i++}`); vals.push(body.descricao) }
      if (body.ativo !== undefined)      { sets.push(`ativo = $${i++}`);     vals.push(body.ativo) }
      vals.push(id)
      await query(`UPDATE lab.agentes SET ${sets.join(", ")} WHERE id = $${i}`, vals)
    }

    if (body.instancias !== undefined) {
      // Desativa todas as instâncias do agente
      await query(`UPDATE lab.agente_instancias SET ativo = false WHERE agente_id = $1`, [id])
      // Reativa/insere as novas
      for (const inst of body.instancias) {
        await query(`
          INSERT INTO lab.agente_instancias (agente_id, instance, ativo)
          VALUES ($1, $2, true)
          ON CONFLICT (instance) DO UPDATE SET agente_id = $1, ativo = true
        `, [id, inst])
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
