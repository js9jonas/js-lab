import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { aplicarImport, calcularImport, GRUPOS_IMPORTAVEIS } from "@/lib/aniversariantesImport"

// POST /api/aniversariantes/importar  { texto, grupo, aplicar? }
// Sem "aplicar": devolve a prévia (quem entra, quem já está, linhas com erro). Com "aplicar": recalcula
// a prévia dentro da transação e grava só os novos — nada que não apareceu como novo é gravado.
export async function POST(req: NextRequest) {
  const { texto, grupo, aplicar } = await req.json().catch(() => ({})) as { texto?: string; grupo?: string; aplicar?: boolean }
  if (!texto?.trim()) return NextResponse.json({ error: "Cole a lista de pessoas." }, { status: 400 })
  if (!grupo || !(GRUPOS_IMPORTAVEIS as readonly string[]).includes(grupo)) {
    return NextResponse.json({ error: "Escolha o grupo (CLIENTE, FAMÍLIA ou AMIGOS)." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    if (!aplicar) return NextResponse.json(await calcularImport(client, texto))
    await client.query("BEGIN")
    const plano = await calcularImport(client, texto)
    const inseridos = await aplicarImport(client, plano, grupo)
    await client.query("COMMIT")
    return NextResponse.json({ inseridos })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[aniversariantes importar]", err)
    return NextResponse.json({ error: "Erro ao importar" }, { status: 500 })
  } finally {
    client.release()
  }
}
