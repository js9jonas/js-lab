// app/api/aprendizados/[id]/route.ts
// PATCH: atualiza tipo, requer_discussao ou nota_discussao de um aprendizado

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json() as {
    tipo?: "correcao" | "lacuna" | "insight"
    requer_discussao?: boolean
    nota_discussao?: string | null
  }

  try {
    const sets: string[] = []
    const vals: unknown[] = []
    let i = 1
    if (body.tipo !== undefined)              { sets.push(`tipo = $${i++}`);              vals.push(body.tipo) }
    if (body.requer_discussao !== undefined)  { sets.push(`requer_discussao = $${i++}`);  vals.push(body.requer_discussao) }
    if (body.nota_discussao !== undefined)    { sets.push(`nota_discussao = $${i++}`);    vals.push(body.nota_discussao) }

    if (sets.length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 })

    vals.push(id)
    await query(`UPDATE lab.agente_aprendizados SET ${sets.join(", ")} WHERE id = $${i}`, vals)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
