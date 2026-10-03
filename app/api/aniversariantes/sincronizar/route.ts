import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"
import { aplicarPlano, assinatura, calcularPlano } from "@/lib/aniversariantesSync"

// GET  /api/aniversariantes/sincronizar → prévia (nada é gravado)
export async function GET() {
  try {
    const plano = await calcularPlano(pool)
    return NextResponse.json({ ...plano, assinatura: assinatura(plano) })
  } catch (err) {
    console.error("[aniversariantes sincronizar GET]", err)
    return NextResponse.json({ error: "Não foi possível calcular a sincronização" }, { status: 500 })
  }
}

// POST /api/aniversariantes/sincronizar { assinatura } → aplica, se o plano ainda for o mesmo da prévia
export async function POST(req: NextRequest) {
  const { assinatura: vista } = await req.json().catch(() => ({}))
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    // Uma sincronização por vez (dois cliques ou duas abas não aplicam em dobro).
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('lab.aniversariantes.sincronizar'))`)
    const plano = await calcularPlano(client)
    if (assinatura(plano) !== vista) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "O cadastro mudou desde a prévia. Revise as mudanças e aplique de novo." }, { status: 409 })
    }
    await aplicarPlano(client, plano)
    await client.query("COMMIT")
    return NextResponse.json({
      ok: true, entraram: plano.entram.length, sairam: plano.saem.length,
      nomes: plano.nomes.length, telefones: plano.telefones.length,
    })
  } catch (err) {
    await client.query("ROLLBACK")
    console.error("[aniversariantes sincronizar POST]", err)
    return NextResponse.json({ error: "Erro ao aplicar a sincronização" }, { status: 500 })
  } finally {
    client.release()
  }
}
