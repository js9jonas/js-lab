// app/api/chat/refinamento/route.ts
// Chat de refinamento do agente com base na conversa real do contato

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

interface HistoricoMsg { role: "user" | "assistant"; content: string }

export async function POST(req: NextRequest) {
  const { jid, instance, message, historico } = await req.json() as {
    jid: string
    instance: string
    message: string
    historico: HistoricoMsg[]
  }

  try {
    // 1. Busca agente vinculado à instância
    const [agente] = await query<{ id: number; nome: string; prompt_atual: string }>(
      `SELECT a.id, a.nome, a.prompt_atual
       FROM lab.agentes a
       JOIN lab.agente_instancias ai ON ai.agente_id = a.id
       WHERE ai.instance = $1 AND ai.ativo = true AND a.ativo = true
       LIMIT 1`,
      [instance]
    )

    if (!agente)
      return NextResponse.json({ error: "Nenhum agente ativo vinculado a esta instância." }, { status: 404 })

    // 2. Busca módulos do agente
    const modulos = await query<{
      id: number; nome: string; descricao: string | null
      gatilhos: string[]; conteudo: string; ativo: boolean
    }>(
      `SELECT id, nome, descricao, gatilhos, conteudo, ativo
       FROM lab.agente_modulos WHERE agente_id = $1 ORDER BY ordem`,
      [agente.id]
    )

    // 3. Busca últimas 40 mensagens da conversa com o contato
    const mensagens = await query<{
      from_me: boolean; content: string | null; message_type: string; timestamp: string
    }>(
      `SELECT from_me, content, message_type, timestamp
       FROM lab.messages
       WHERE jid = $1
       ORDER BY timestamp DESC LIMIT 40`,
      [jid]
    )
    const mensagensOrdenadas = [...mensagens].reverse()

    // 4. Formata conversa para o prompt
    const conversaTexto = mensagensOrdenadas.length > 0
      ? mensagensOrdenadas.map(m => {
          const hora = new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          const quem = m.from_me ? "Atendente" : "Cliente"
          const texto = m.content ?? `[${m.message_type}]`
          return `[${hora}] ${quem}: ${texto}`
        }).join("\n")
      : "(nenhuma mensagem registrada)"

    // 5. Formata módulos
    const modulosTexto = modulos.length > 0
      ? modulos.map(m =>
          `[MÓDULO #${m.id} — ${m.nome}${m.ativo ? "" : " (INATIVO)"}]\n` +
          `Gatilhos: ${m.gatilhos.length > 0 ? m.gatilhos.join(", ") : "(nenhum)"}\n` +
          (m.descricao ? `Descrição: ${m.descricao}\n` : "") +
          `Conteúdo:\n${m.conteudo || "(vazio)"}`
        ).join("\n\n---\n\n")
      : "(nenhum módulo criado ainda)"

    // 6. System prompt
    const systemPrompt = `Você é um especialista em arquitetura de agentes de IA conversacional para atendimento via WhatsApp.

Você está ajudando a refinare o agente "${agente.nome}" com base em conversas reais que ele atende.

═══ PROMPT BASE ATUAL ═══
${agente.prompt_atual || "(vazio — ainda não definido)"}
═══════════════════════

═══ MÓDULOS ATUAIS (${modulos.length}) ═══
${modulosTexto}
═══════════════════════

═══ CONVERSA REAL COM O CONTATO (últimas mensagens) ═══
${conversaTexto}
═══════════════════════

Seu papel nesta conversa:
1. Analisar a conversa real para identificar padrões, dúvidas frequentes e gaps de conhecimento do agente
2. Sugerir melhorias no prompt base com base nos padrões observados
3. Sugerir novos módulos ou melhorar módulos existentes com base nos assuntos abordados
4. Identificar respostas que o agente poderia ter dado melhor

Quando sugerir atualização do prompt base, use exatamente este formato:
<<<PROMPT_ATUALIZADO>>>
[texto completo do novo prompt]
<<<FIM_PROMPT>>>

Quando sugerir um módulo novo ou atualizado, use exatamente este formato:
<<<MODULO>>>
nome: [nome do módulo]
descricao: [para que serve]
gatilhos: [palavra1, palavra2, palavra3]
conteudo:
[texto completo do módulo]
<<<FIM_MODULO>>>

Seja direto e orientado a resultados. Analise o que a conversa real revela sobre o que o agente precisa saber melhor.`

    // 7. Monta mensagens para a API
    const messages: HistoricoMsg[] = [
      ...(historico ?? []),
      { role: "user", content: message },
    ]

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
        max_tokens: 2048,
        system: systemPrompt,
        messages,
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

    return NextResponse.json({
      resposta,
      promptSugerido,
      modulosSugeridos,
      agente_id: agente.id,
      agente_nome: agente.nome,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
