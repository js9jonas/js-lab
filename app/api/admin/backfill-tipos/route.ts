// app/api/admin/backfill-tipos/route.ts
// Rota one-time: aplica migração de colunas e classifica aprendizados existentes via Claude
// Chamar uma vez via POST /api/admin/backfill-tipos

import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST() {
  const log: string[] = []

  try {
    // 1. Migração: adiciona colunas se não existirem
    await query(`
      ALTER TABLE lab.agente_aprendizados
        ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'lacuna'
          CHECK (tipo IN ('correcao', 'lacuna', 'insight')),
        ADD COLUMN IF NOT EXISTS requer_discussao BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS nota_discussao TEXT
    `)
    log.push("✓ Colunas adicionadas (tipo, requer_discussao, nota_discussao)")

    // 2. Busca todos os aprendizados sem tipo definido (ainda com default)
    const itens = await query<{
      id: number; sugestao_ia: string; resposta_real: string
    }>(
      `SELECT id, sugestao_ia, resposta_real
       FROM lab.agente_aprendizados
       WHERE tipo = 'lacuna' AND requer_discussao = false
       ORDER BY criado_em ASC`
    )

    if (itens.length === 0) {
      log.push("Nenhum item para classificar.")
      return NextResponse.json({ ok: true, log })
    }

    log.push(`Classificando ${itens.length} aprendizados...`)

    // 3. Chama OpenAI para classificar todos de uma vez
    const listaFormatada = itens.map((item, i) =>
      `[${i + 1}] id=${item.id}\nAgente sugeriu: "${item.sugestao_ia}"\nUsuário enviou: "${item.resposta_real}"`
    ).join("\n\n")

    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Você classifica registros de aprendizado de um agente de IA de atendimento via WhatsApp.

Para cada item, retorne APENAS um objeto JSON com a chave "itens" contendo um array:
{"itens": [{"id": número, "tipo": "correcao|lacuna|insight", "requer_discussao": true|false, "nota": "motivo breve se requer_discussao=true, senão null"}]}

Definições:
- "correcao": o agente deu informação errada, tom inadequado ou cometeu um erro claro
- "lacuna": o agente não sabia sobre o assunto (preço, produto, procedimento, política etc.)
- "insight": ambas as respostas eram razoáveis mas o usuário melhorou a abordagem/estilo

requer_discussao=true quando a diferença revela uma ambiguidade ou gap que precisa ser discutido e esclarecido no refinamento do agente.`,
          },
          { role: "user", content: listaFormatada },
        ],
      }),
    })

    const data = await apiRes.json() as {
      choices?: { message: { content: string } }[]
      error?: { message: string }
    }

    if (!data.choices || data.error) {
      return NextResponse.json({ ok: false, log, error: data.error?.message ?? "Resposta inesperada da API", raw: data }, { status: 500 })
    }

    const texto = data.choices[0].message.content.trim()
    const textoLimpo = texto.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim()

    let classificacoes: { id: number; tipo: string; requer_discussao: boolean; nota: string | null }[]
    try {
      const parsed = JSON.parse(textoLimpo)
      classificacoes = Array.isArray(parsed) ? parsed : (parsed.itens ?? [])
    } catch {
      return NextResponse.json({ ok: false, log, error: "Falha ao parsear resposta da API", raw: texto }, { status: 500 })
    }

    // 4. Atualiza cada item no banco
    let atualizados = 0
    for (const c of classificacoes) {
      await query(
        `UPDATE lab.agente_aprendizados
         SET tipo = $1, requer_discussao = $2, nota_discussao = $3
         WHERE id = $4`,
        [c.tipo, c.requer_discussao, c.nota ?? null, c.id]
      )
      atualizados++
      log.push(`  id=${c.id} → ${c.tipo}${c.requer_discussao ? " ⚠ requer discussão" : ""}`)
    }

    log.push(`✓ ${atualizados} itens classificados`)
    return NextResponse.json({ ok: true, log })

  } catch (err) {
    return NextResponse.json({ ok: false, log, error: String(err) }, { status: 500 })
  }
}
