import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { dataComAno } from "@/lib/aniversariantesImport"

// GET /api/aniversariantes
// ?search=&grupo=&ativo=true&mes=4
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") ?? ""
  const grupo  = searchParams.get("grupo")  ?? ""
  const ativo  = searchParams.get("ativo")  ?? ""
  const mes    = searchParams.get("mes")    ?? ""

  const conditions: string[] = []
  const params: unknown[]    = []
  let p = 1

  if (search) {
    conditions.push(`nome ILIKE $${p++}`)
    params.push(`%${search}%`)
  }
  if (grupo) {
    conditions.push(`grupo ILIKE $${p++}`)
    params.push(`%${grupo}%`)
  }
  if (ativo !== "") {
    conditions.push(`ativo = $${p++}`)
    params.push(ativo === "true")
  }
  if (mes) {
    conditions.push(`EXTRACT(MONTH FROM data_nasc) = $${p++}`)
    params.push(Number(mes))
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const sql = `
    SELECT
      id, nome, telefone, data_nasc, grupo, ativo, observacao, criado_em, ano_desconhecido,
      CASE WHEN ano_desconhecido THEN NULL
           ELSE EXTRACT(YEAR FROM NOW())::int - EXTRACT(YEAR FROM data_nasc)::int END AS idade,
      TO_CHAR(data_nasc, 'DD/MM')  AS dia_mes
    FROM lab.aniversariantes
    ${where}
    ORDER BY EXTRACT(MONTH FROM data_nasc), EXTRACT(DAY FROM data_nasc), nome
  `
  try {
    const rows = await query(sql, params)
    return NextResponse.json(rows)
  } catch (err) {
    console.error("[aniversariantes GET]", err)
    return NextResponse.json({ error: "Erro ao buscar registros" }, { status: 500 })
  }
}

// POST /api/aniversariantes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, telefone, data_nasc, grupo, observacao } = body
    const anoDesconhecido = body.ano_desconhecido === true

    if (!nome || !data_nasc) {
      return NextResponse.json({ error: "nome e data_nasc são obrigatórios" }, { status: 400 })
    }

    const sql = `
      INSERT INTO lab.aniversariantes (nome, telefone, data_nasc, ano_desconhecido, grupo, observacao)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    const rows = await query(sql, [nome, telefone || null, dataComAno(String(data_nasc), anoDesconhecido), anoDesconhecido, grupo || null, observacao || null])
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("[aniversariantes POST]", err)
    return NextResponse.json({ error: "Erro ao criar registro" }, { status: 500 })
  }
}