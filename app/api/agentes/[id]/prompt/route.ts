import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

// POST /api/agentes/[id]/prompt  { prompt, motivo? }
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const { prompt, motivo } = await req.json() as { prompt: string; motivo?: string }

  if (!prompt?.trim())
    return NextResponse.json({ error: "prompt obrigatório" }, { status: 400 })

  try {
    const [versaoRow] = await query<{ max: number }>(
      `SELECT COALESCE(MAX(versao), 0) AS max FROM lab.agente_prompt_versoes WHERE agente_id = $1`,
      [id]
    )
    const novaVersao = (versaoRow?.max ?? 0) + 1

    await query(
      `INSERT INTO lab.agente_prompt_versoes (agente_id, versao, prompt, motivo) VALUES ($1,$2,$3,$4)`,
      [id, novaVersao, prompt, motivo ?? null]
    )
    await query(
      `UPDATE lab.agentes SET prompt_atual = $1, atualizado_em = NOW() WHERE id = $2`,
      [prompt, id]
    )

    return NextResponse.json({ ok: true, versao: novaVersao })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
