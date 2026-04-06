// app/api/agenda/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mes = searchParams.get("mes")
  const ano = searchParams.get("ano")
  const categoria_id = searchParams.get("categoria_id")
  const local = searchParams.get("local")
  const q = searchParams.get("q")

  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (mes && ano) {
    conditions.push(`DATE_TRUNC('month', e.data) = $${i++}::date`)
    params.push(`${ano}-${mes.padStart(2, "0")}-01`)
  } else if (ano) {
    conditions.push(`EXTRACT(YEAR FROM e.data) = $${i++}`)
    params.push(Number(ano))
  }

  if (categoria_id) {
    conditions.push(`e.id_categoria = $${i++}`)
    params.push(Number(categoria_id))
  }

  if (local) {
    conditions.push(`e.local ILIKE $${i++}`)
    params.push(`%${local}%`)
  }

  if (q) {
    conditions.push(`(e.titulo ILIKE $${i++} OR e.descricao ILIKE $${i++} OR e.observacoes ILIKE $${i++})`)
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    i += 2
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const { rows } = await pool.query(
    `SELECT
      e.id, e.titulo, e.descricao, e.data,
      TO_CHAR(e.hora, 'HH24:MI') AS hora,
      TO_CHAR(e.hora_fim, 'HH24:MI') AS hora_fim,
      e.local, e.epoca_costume, e.observacoes, e.ativo,
      e.id_categoria,
      c.nome AS categoria_nome,
      c.cor AS categoria_cor,
      c.icone AS categoria_icone
    FROM lab.eventos e
    LEFT JOIN lab.evento_categorias c ON c.id = e.id_categoria
    ${where}
    ORDER BY e.data ASC, e.hora ASC NULLS LAST`,
    params
  )

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    titulo, descricao, data, hora, hora_fim,
    local, id_categoria, epoca_costume, observacoes
  } = body

  const { rows } = await pool.query(
    `INSERT INTO lab.eventos
      (titulo, descricao, data, hora, hora_fim, local, id_categoria, epoca_costume, observacoes)
     VALUES ($1,$2,$3,
       NULLIF($4,'')::time, NULLIF($5,'')::time,
       NULLIF($6,''), $7, NULLIF($8,''), NULLIF($9,''))
     RETURNING id`,
    [titulo, descricao || null, data,
     hora || '', hora_fim || '',
     local || '', id_categoria || null,
     epoca_costume || '', observacoes || '']
  )

  return NextResponse.json({ id: rows[0].id }, { status: 201 })
}