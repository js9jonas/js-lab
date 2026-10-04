import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { dataComAno } from "@/lib/aniversariantesImport"

// PATCH /api/aniversariantes/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    const id   = Number(rawId)
    const body = await req.json()
    const { nome, telefone, grupo, ativo, observacao } = body
    // ano_desconhecido só muda quando vem junto com a data (o modal sempre manda os dois)
    const anoDesconhecido: boolean | null = typeof body.ano_desconhecido === "boolean" && body.data_nasc ? body.ano_desconhecido : null
    const data_nasc = body.data_nasc ? dataComAno(String(body.data_nasc), anoDesconhecido === true) : null

    const sql = `
      UPDATE lab.aniversariantes
      SET
        nome          = COALESCE($1, nome),
        telefone      = CASE WHEN $9 THEN $2 ELSE telefone END,
        data_nasc     = COALESCE($3, data_nasc),
        grupo         = COALESCE($4, grupo),
        ativo         = COALESCE($5, ativo),
        observacao    = CASE WHEN $10 THEN $6 ELSE observacao END,
        ano_desconhecido = COALESCE($8, ano_desconhecido),
        atualizado_em = NOW()
      WHERE id = $7
      RETURNING *
    `
    const rows = await query(sql, [
      nome ?? null,
      telefone?.trim() || null,
      data_nasc ?? null,
      grupo ?? null,
      ativo ?? null,
      observacao?.trim() || null,
      id,
      anoDesconhecido,
      // Só mexe em telefone/observação quando vieram no corpo — o botão de ativo da lista manda
      // só { ativo } e antes apagava os dois (achado 03/10/2026)
      "telefone" in body,
      "observacao" in body,
    ])

    if (!rows.length) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("[aniversariantes PATCH]", err)
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 })
  }
}

// DELETE /api/aniversariantes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params
    const id = Number(rawId)
    await query("DELETE FROM lab.aniversariantes WHERE id = $1", [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[aniversariantes DELETE]", err)
    return NextResponse.json({ error: "Erro ao deletar" }, { status: 500 })
  }
}