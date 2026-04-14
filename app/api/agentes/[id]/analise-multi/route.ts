// app/api/agentes/[id]/analise-multi/route.ts
// Analisa padrões em múltiplas conversas recentes para sugerir melhorias no agente

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params

  try {
    // 1. Busca agente com analisado_ate
    const [agente] = await query<{
      id: number; nome: string; prompt_atual: string; analisado_ate: string | null
    }>(
      `SELECT id, nome, prompt_atual, analisado_ate::text FROM lab.agentes WHERE id = $1`, [id]
    )
    if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })

    // 2. Instâncias vinculadas ao agente
    const instancias = await query<{ instance: string }>(
      `SELECT instance FROM lab.agente_instancias WHERE agente_id = $1 AND ativo = true`, [id]
    )
    if (instancias.length === 0)
      return NextResponse.json({ error: "Agente sem instâncias vinculadas" }, { status: 400 })

    const instanceNames = instancias.map(i => i.instance)

    // 3. Janela de análise: desde última análise ou últimos 30 dias
    const desde = agente.analisado_ate
      ? new Date(agente.analisado_ate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // 4. Conversas com atividade no período (máx 40)
    const conversas = await query<{ jid: string; profile_name: string | null }>(
      `SELECT jid, profile_name
       FROM lab.conversations
       WHERE instance = ANY($1) AND last_message_at >= $2
       ORDER BY last_message_at DESC
       LIMIT 40`,
      [instanceNames, desde]
    )

    if (conversas.length === 0) {
      return NextResponse.json({
        resposta: `Nenhuma conversa nova desde ${desde.toLocaleDateString("pt-BR")}. Análise não necessária.`,
        promptSugerido: null,
        modulosSugeridos: [],
        conversas_analisadas: 0,
        mensagens_analisadas: 0,
      })
    }

    // 5. Para cada conversa, coleta mensagens do cliente no período (máx 10)
    const blocos: string[] = []
    let totalMsgs = 0

    for (const conv of conversas) {
      const msgs = await query<{ content: string | null; message_type: string }>(
        `SELECT content, message_type
         FROM lab.messages
         WHERE jid = $1 AND from_me = false AND timestamp >= $2
         ORDER BY timestamp ASC
         LIMIT 10`,
        [conv.jid, desde]
      )

      const textos = msgs.filter(m => m.content).map(m => `"${m.content}"`)
      if (textos.length === 0) continue

      const audioCount = msgs.filter(m => m.message_type === "audioMessage").length
      const nome = conv.profile_name ?? conv.jid.split("@")[0]

      let bloco = `[${nome}]\n${textos.join("\n")}`
      if (audioCount > 0) bloco += `\n(+ ${audioCount} áudio(s) não analisado(s))`

      blocos.push(bloco)
      totalMsgs += textos.length
    }

    if (blocos.length === 0) {
      return NextResponse.json({
        resposta: "Conversas encontradas, mas sem mensagens de texto dos clientes no período.",
        promptSugerido: null,
        modulosSugeridos: [],
        conversas_analisadas: 0,
        mensagens_analisadas: 0,
      })
    }

    // 6. Módulos atuais do agente
    const modulos = await query<{ id: number; nome: string; gatilhos: string[]; conteudo: string; ativo: boolean }>(
      `SELECT id, nome, gatilhos, conteudo, ativo FROM lab.agente_modulos WHERE agente_id = $1 ORDER BY ordem`, [id]
    )

    const modulosTexto = modulos.length > 0
      ? modulos.map(m =>
          `[MÓDULO #${m.id} — ${m.nome}${m.ativo ? "" : " (INATIVO)"}]\n` +
          `Gatilhos: ${m.gatilhos.length > 0 ? m.gatilhos.join(", ") : "(nenhum)"}\n` +
          `Conteúdo: ${m.conteudo || "(vazio)"}`
        ).join("\n\n---\n\n")
      : "(nenhum módulo criado ainda)"

    // 7. System prompt para análise de padrões
    const systemPrompt = `Você é um especialista em arquitetura de agentes de IA conversacional para atendimento via WhatsApp.

Sua tarefa é analisar mensagens reais de clientes de ${blocos.length} conversas distintas (período: ${desde.toLocaleDateString("pt-BR")} até hoje) e identificar padrões que revelam lacunas no agente.

═══ AGENTE: ${agente.nome} ═══

═══ PROMPT BASE ATUAL ═══
${agente.prompt_atual || "(vazio)"}
═══════════════════════

═══ MÓDULOS ATUAIS (${modulos.length}) ═══
${modulosTexto}
═══════════════════════

═══ MENSAGENS DOS CLIENTES (${totalMsgs} msgs de ${blocos.length} conversas) ═══
${blocos.join("\n\n")}
═══════════════════════

Analise os padrões e:
1. Liste os temas/dúvidas que aparecem em múltiplas conversas (em ordem de frequência)
2. Verifique quais já são cobertos pelos módulos atuais e quais não são
3. Sugira módulos novos ou atualizações nos existentes para cobrir as lacunas
4. Sugira ajuste no prompt base somente se necessário

Seja objetivo: apresente os padrões encontrados antes de sugerir mudanças.

Quando sugerir atualização do prompt base:
<<<PROMPT_ATUALIZADO>>>
[texto completo]
<<<FIM_PROMPT>>>

Quando sugerir módulo novo ou atualizado:
<<<MODULO>>>
nome: [nome]
descricao: [para que serve]
gatilhos: [palavra1, palavra2, palavra3]
conteudo:
[texto completo]
<<<FIM_MODULO>>>`

    // 8. Chama Claude
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Analise as ${blocos.length} conversas e identifique os padrões mais relevantes para melhorar o agente.`,
        }],
      }),
    })

    const data = await apiRes.json() as { content: { type: string; text: string }[] }
    const resposta = data.content.filter(b => b.type === "text").map(b => b.text).join("")

    // 9. Extrai sugestões estruturadas
    const promptMatch = resposta.match(/<<<PROMPT_ATUALIZADO>>>([\s\S]*?)<<<FIM_PROMPT>>>/)
    const promptSugerido = promptMatch ? promptMatch[1].trim() : null

    const moduloMatches = [...resposta.matchAll(/<<<MODULO>>>([\s\S]*?)<<<FIM_MODULO>>>/g)]
    const modulosSugeridos = moduloMatches.map(m => {
      const bloco    = m[1]
      const nome     = bloco.match(/nome:\s*(.+)/)?.[1]?.trim() ?? ""
      const descricao = bloco.match(/descricao:\s*(.+)/)?.[1]?.trim() ?? null
      const gatilhos = bloco.match(/gatilhos:\s*(.+)/)?.[1]?.split(",").map(g => g.trim()).filter(Boolean) ?? []
      const conteudo = bloco.match(/conteudo:\n([\s\S]+)/)?.[1]?.trim() ?? ""
      return { nome, descricao, gatilhos, conteudo }
    })

    // 10. Marca timestamp da análise
    await query(`UPDATE lab.agentes SET analisado_ate = NOW() WHERE id = $1`, [id])

    return NextResponse.json({
      resposta,
      promptSugerido,
      modulosSugeridos,
      conversas_analisadas: blocos.length,
      mensagens_analisadas: totalMsgs,
      desde: desde.toISOString(),
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
