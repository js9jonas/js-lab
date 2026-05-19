import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { Rifa, RifaPayload } from "@/app/rifas/types"

export async function GET() {
  try {
    const rows = await query<Rifa & { total_premios: number }>(
      `SELECT r.*, o.nome AS org_nome,
              (SELECT COUNT(*) FROM lab.rifa_premios p WHERE p.rifa_id = r.id) AS total_premios
       FROM lab.rifas r
       LEFT JOIN lab.rifa_organizacoes o ON o.id = r.organizacao_id
       ORDER BY r.criado_em DESC`
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body: RifaPayload = await req.json()
    const { premios, ...dados } = body

    const [rifa] = await query<Rifa>(
      `INSERT INTO lab.rifas
        (organizacao_id, titulo, detalhes, valor_numero, data_sorteio, local_sorteio,
         numero_inicial, quantidade_total, numeros_por_pagina, colunas_premios,
         tema, fonte, borda_estilo, zebrado, emoji_premios, fundo_cabecalho, orientacao, tamanho_papel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
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
      ]
    )

    if (premios?.length) {
      for (const p of premios) {
        await query(
          `INSERT INTO lab.rifa_premios (rifa_id, posicao, descricao) VALUES ($1,$2,$3)`,
          [rifa.id, p.posicao, p.descricao]
        )
      }
    }

    return NextResponse.json(rifa, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
