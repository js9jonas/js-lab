import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// PATCH /api/aniversariantes/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id   = Number(params.id)
    const body = await req.json()
    const { nome, telefone, data_nasc, grupo, ativo, observacao } = body

    const sql = `
      UPDATE lab.aniversariantes
      SET
        nome          = COALESCE($1, nome),
        telefone      = $2,
        data_nasc     = COALESCE($3, data_nasc),
        grupo         = COALESCE($4, grupo),
        ativo         = COALESCE($5, ativo),
        observacao    = $6,
        atualizado_em = NOW()
      WHERE id = $7
      RETURNING *
    `
    const rows = await query(sql, [
      nome ?? null,
      telefone ?? null,
      data_nasc ?? null,
      grupo ?? null,
      ativo ?? null,
      observacao ?? null,
      id,
    ])

    if (!rows.length) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("[aniversariantes PATCH]", err)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

// DELETE /api/aniversariantes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    await query("DELETE FROM lab.aniversariantes WHERE id = $1", [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[aniversariantes DELETE]", err)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}