// app/api/agentes/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface AgenteRow {
  id: number
  nome: string
  descricao: string | null
  prompt_atual: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
  instancias: string[]          // nomes das instâncias vinculadas
  aprendizados_pendentes: number
}

export async function GET() {
  try {
    const rows = await query<AgenteRow>(`
      SELECT
        a.id, a.nome, a.descricao, a.prompt_atual, a.ativo,
        a.criado_em::text, a.atualizado_em::text,
        COALESCE(
          ARRAY_AGG(ai.instance ORDER BY ai.instance) FILTER (WHERE ai.instance IS NOT NULL),
          '{}'
        ) AS instancias,
        COUNT(ap.id) FILTER (WHERE ap.incorporado = false) AS aprendizados_pendentes
      FROM lab.agentes a
      LEFT JOIN lab.agente_instancias ai ON ai.agente_id = a.id AND ai.ativo = true
      LEFT JOIN lab.agente_aprendizados ap ON ap.agente_id = a.id
      GROUP BY a.id
      ORDER BY a.ativo DESC, a.nome
    `)
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { nome, descricao, prompt_base, instancias } = await req.json() as {
    nome: string
    descricao?: string
    prompt_base: string
    instancias?: string[]
  }

  try {
    const [agente] = await query<{ id: number }>(`
      INSERT INTO lab.agentes (nome, descricao, prompt_base, prompt_atual)
      VALUES ($1, $2, $3, $3)
      RETURNING id
    `, [nome, descricao ?? null, prompt_base])

    // Salva primeira versão
    await query(`
      INSERT INTO lab.agente_prompt_versoes (agente_id, versao, prompt, motivo)
      VALUES ($1, 1, $2, 'Versão inicial')
    `, [agente.id, prompt_base])

    // Vincula instâncias
    if (instancias?.length) {
      for (const inst of instancias) {
        await query(`
          INSERT INTO lab.agente_instancias (agente_id, instance)
          VALUES ($1, $2)
          ON CONFLICT (instance) DO UPDATE SET agente_id = $1, ativo = true
        `, [agente.id, inst])
      }
    }

    return NextResponse.json({ ok: true, id: agente.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}