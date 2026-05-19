import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { Rifa, RifaPayload } from "@/app/rifas/types"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [rifa] = await query<Rifa>(
      `SELECT r.*, row_to_json(o) AS organizacao
       FROM lab.rifas r
       LEFT JOIN lab.rifa_organizacoes o ON o.id = r.organizacao_id
       WHERE r.id = $1`,
      [id]
    )
    if (!rifa) return NextResponse.json({ error: "Não encontrada" }, { status: 404 })

    const premios = await query(
      `SELECT * FROM lab.rifa_premios WHERE rifa_id = $1 ORDER BY posicao`,
      [id]
    )
    return NextResponse.json({ ...rifa, premios })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body: RifaPayload = await req.json()
    const { premios, ...dados } = body

    const [rifa] = await query<Rifa>(
      `UPDATE lab.rifas SET
        organizacao_id=$1, titulo=$2, detalhes=$3, valor_numero=$4,
        data_sorteio=$5, local_sorteio=$6, numero_inicial=$7, quantidade_total=$8,
        numeros_por_pagina=$9, colunas_premios=$10, tema=$11, fonte=$12,
        borda_estilo=$13, zebrado=$14, emoji_premios=$15, fundo_cabecalho=$16,
        orientacao=$17, tamanho_papel=$18, atualizado_em=NOW()
       WHERE id=$19 RETURNING *`,
      [
        dados.organizacao_id || null,
        dados.titulo,
        dados.detalhes || null,
        dados.valor_numero,
        dados.data_sorteio || null,
        dados.local_sorteio || null,
        dados.numero_inicial,
        dados.quantidade_total,
        dados.numeros_por_pagina,
        dados.colunas_premios,
        dados.tema,
        dados.fonte,
        dados.borda_estilo,
        dados.zebrado,
        dados.emoji_premios,
        dados.fundo_cabecalho,
        dados.orientacao,
        dados.tamanho_papel,
        id,
      ]
    )
    if (!rifa) return NextResponse.json({ error: "Não encontrada" }, { status: 404 })

    await query(`DELETE FROM lab.rifa_premios WHERE rifa_id = $1`, [id])
    for (const p of premios ?? []) {
      await query(
        `INSERT INTO lab.rifa_premios (rifa_id, posicao, descricao) VALUES ($1,$2,$3)`,
        [id, p.posicao, p.descricao]
      )
    }

    return NextResponse.json(rifa)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM lab.rifas WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
