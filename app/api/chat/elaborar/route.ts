// app/api/chat/elaborar/route.ts
// Chat interno com o agente para elaborar uma mensagem a enviar ao contato

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
       FROM lab.agente_modulos WHERE agente_id = $1 AND ativo = true ORDER BY ordem`,
      [agente.id]
    )

    // 3. Busca últimas 40 mensagens da conversa
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

    // 5. Formata módulos ativos
    const modulosTexto = modulos.length > 0
      ? modulos.map(m =>
          `[${m.nome}${m.descricao ? ` — ${m.descricao}` : ""}]\n` +
          (m.gatilhos.length > 0 ? `Gatilhos: ${m.gatilhos.join(", ")}\n` : "") +
          `${m.conteudo || "(vazio)"}`
        ).join("\n\n---\n\n")
      : "(nenhum módulo ativo)"

    // 6. System prompt
    const systemPrompt = `Você é o agente "${agente.nome}", assistindo o operador humano a redigir a próxima mensagem para o contato.

═══ SEU PROMPT BASE ═══
${agente.prompt_atual || "(vazio — ainda não definido)"}
═══════════════════════

${modulos.length > 0 ? `═══ SEUS MÓDULOS DE CONHECIMENTO ═══\n${modulosTexto}\n═══════════════════════\n\n` : ""}═══ CONVERSA ATUAL COM O CONTATO ═══
${conversaTexto}
═══════════════════════

Seu papel nesta conversa interna com o operador:
1. Entender a intenção ou detalhes que ele quer transmitir ao contato
2. Fazer perguntas de esclarecimento quando necessário
3. Considerar o contexto da conversa e seu prompt base ao elaborar a mensagem
4. Quando tiver informação suficiente, gerar a mensagem pronta para envio

Quando estiver pronto para gerar a mensagem final, use EXATAMENTE este formato:
<<<MENSAGEM>>>
[texto da mensagem a ser enviada ao contato, sem introduções ou explicações extras]
<<<FIM_MENSAGEM>>>

Antes de gerar a mensagem, você pode conversar com o operador para entender melhor a intenção. Seja objetivo e foque em criar a mensagem mais eficaz para o momento da conversa.`

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
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await apiRes.json() as { content: { type: string; text: string }[] }
    const resposta = data.content.filter(b => b.type === "text").map(b => b.text).join("")

    // 9. Extrai mensagem gerada, se houver
    const mensagemMatch = resposta.match(/<<<MENSAGEM>>>([\s\S]*?)<<<FIM_MENSAGEM>>>/)
    const mensagemGerada = mensagemMatch ? mensagemMatch[1].trim() : null

    return NextResponse.json({
      resposta,
      mensagemGerada,
      agente_id: agente.id,
      agente_nome: agente.nome,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
