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

    // Classifica automaticamente via Claude (Haiku — rápido e barato)
    let tipo: "correcao" | "lacuna" | "insight" = "lacuna"
    let requer_discussao = false
    let nota_discussao: string | null = null

    try {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          system: `Classifique este registro de aprendizado de um agente de atendimento WhatsApp.
Responda SOMENTE um JSON: {"tipo":"correcao|lacuna|insight","requer_discussao":true|false,"nota":"motivo breve se requer_discussao=true, senão null"}
- correcao: agente deu informação errada ou tom inadequado
- lacuna: agente não sabia sobre o assunto (preço, produto, procedimento)
- insight: ambas razoáveis, usuário melhorou a abordagem
requer_discussao=true quando a diferença revela ambiguidade que precisa ser esclarecida no refinamento.`,
          messages: [
            {
              role: "user",
              content: `Agente sugeriu: "${sugestao_ia}"\nUsuário enviou: "${resposta_real}"`,
            },
          ],
        }),
      })
      const data = await apiRes.json() as { content?: { type: string; text: string }[] }
      const texto = data.content?.[0]?.text?.trim() ?? ""
      const classificacao = JSON.parse(texto) as { tipo: typeof tipo; requer_discussao: boolean; nota: string | null }
      tipo = classificacao.tipo ?? "lacuna"
      requer_discussao = classificacao.requer_discussao ?? false
      nota_discussao = classificacao.nota ?? null
    } catch {
      // Falha silenciosa — salva com defaults
    }

    await query(
      `INSERT INTO lab.agente_aprendizados
        (agente_id, jid, instance, contexto, sugestao_ia, resposta_real, tipo, requer_discussao, nota_discussao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [agente_id, jid, instance, JSON.stringify(contexto), sugestao_ia, resposta_real, tipo, requer_discussao, nota_discussao]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
