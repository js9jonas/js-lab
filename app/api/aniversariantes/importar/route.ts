import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { aplicarImport, calcularImport } from "@/lib/aniversariantesImport"

// POST /api/aniversariantes/importar  { texto, aplicar? } — grupo automático (CLIENTE ou AMIGO - FAMÍLIA)
// Sem "aplicar": devolve a prévia (quem entra, quem já está, linhas com erro). Com "aplicar": recalcula
// a prévia dentro da transação e grava só os novos — nada que não apareceu como novo é gravado.
export async function POST(req: NextRequest) {
  const { texto, aplicar } = await req.json().catch(() => ({})) as { texto?: string; aplicar?: boolean }
  if (!texto?.trim()) return NextResponse.json({ error: "Cole a lista de pessoas." }, { status: 400 })

  const client = await pool.connect()
  try {
    if (!aplicar) return NextResponse.json(await calcularImport(client, texto))
    await client.query("BEGIN")
    const plano = await calcularImport(client, texto)
    const inseridos = await aplicarImport(client, plano)
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
