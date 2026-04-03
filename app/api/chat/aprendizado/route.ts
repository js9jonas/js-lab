// app/api/chat/aprendizado/route.ts
// Registra quando o usuário envia resposta diferente da sugestão do agente

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(req: NextRequest) {
  const { agente_id, jid, instance, sugestao_ia, resposta_real } = await req.json() as {
    agente_id: number
    jid: string
    instance: string
    sugestao_ia: string
    resposta_real: string
  }

  try {
    // Busca contexto do dia para salvar junto ao aprendizado
    const contexto = await query(
      `SELECT from_me, content, message_type, timestamp
       FROM lab.messages
       WHERE jid = $1
         AND DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'
       ORDER BY timestamp ASC`,
      [jid]
    )

    await query(
      `INSERT INTO lab.agente_aprendizados
        (agente_id, jid, instance, contexto, sugestao_ia, resposta_real)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agente_id, jid, instance, JSON.stringify(contexto), sugestao_ia, resposta_real]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}