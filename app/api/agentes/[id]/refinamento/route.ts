// app/api/agentes/[id]/refinamento/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const msgs = await query<{ role: string; content: string; criado_em: string }>(
      `SELECT role, content, criado_em::text FROM lab.agente_refinamento
       WHERE agente_id = $1 ORDER BY criado_em ASC`, [id]
    )
    return NextResponse.json(msgs)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const { message } = await req.json() as { message: string }

  try {
    const [agente] = await query<{ nome: string; prompt_atual: string }>(
      `SELECT nome, prompt_atual FROM lab.agentes WHERE id = $1`, [id]
    )
    if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 })

    const modulos = await query<{
      id: number; nome: string; descricao: string | null
      gatilhos: string[]; conteudo: string; ordem: number; ativo: boolean
    }>(
      `SELECT id, nome, descricao, gatilhos, conteudo, ordem, ativo
       FROM lab.agente_modulos WHERE agente_id = $1 ORDER BY ordem`, [id]
    )

    const aprendizados = await query<{
      sugestao_ia: string; resposta_real: string; criado_em: string
      tipo: string; requer_discussao: boolean; nota_discussao: string | null
    }>(
      `SELECT sugestao_ia, resposta_real, criado_em::text,
              COALESCE(tipo, 'lacuna') AS tipo,
              COALESCE(requer_discussao, false) AS requer_discussao,
              nota_discussao
       FROM lab.agente_aprendizados
       WHERE agente_id = $1 AND incorporado = false
       ORDER BY requer_discussao DESC, criado_em DESC LIMIT 20`, [id]
    )

    const historico = await query<{ role: string; content: string }>(
      `SELECT role, content FROM lab.agente_refinamento
       WHERE agente_id = $1 ORDER BY criado_em ASC LIMIT 40`, [id]
    )

    const modulosTexto = modulos.length > 0
      ? modulos.map(m =>
          `[MÓDULO #${m.id} — ${m.nome}${m.ativo ? "" : " (INATIVO)"}]\n` +
          `Gatilhos: ${m.gatilhos.length > 0 ? m.gatilhos.join(", ") : "(nenhum)"}\n` +
          (m.descricao ? `Descrição: ${m.descricao}\n` : "") +
          `Conteúdo:\n${m.conteudo || "(vazio)"}`
        ).join("\n\n---\n\n")
      : "(nenhum módulo criado ainda)"

    const systemPrompt = `Você é um especialista em arquitetura de agentes de IA conversacional para atendimento via WhatsApp.

Você está ajudando a construir e refinar o agente "${agente.nome}".

Você tem total compreensão de como prompts funcionam, como módulos contextuais são injetados dinamicamente, e como estruturar conhecimento para maximizar a qualidade das respostas.

═══ PROMPT BASE ATUAL ═══
${agente.prompt_atual || "(vazio — ainda não definido)"}
═══════════════════════

═══ MÓDULOS ATUAIS (${modulos.length}) ═══
${modulosTexto}
═══════════════════════

${aprendizados.length > 0 ? (() => {
  const tipoLabel: Record<string, string> = { correcao: "CORREÇÃO", lacuna: "LACUNA", insight: "INSIGHT" }
  const discussao = aprendizados.filter(a => a.requer_discussao)
  const resto = aprendizados.filter(a => !a.requer_discussao)

  const formatar = (a: typeof aprendizados[0], i: number) =>
    `[${i + 1}] ${new Date(a.criado_em).toLocaleDateString("pt-BR")} — ${tipoLabel[a.tipo] ?? a.tipo}` +
    (a.nota_discussao ? `\n  ⚠ Nota: ${a.nota_discussao}` : "") +
    `\n  Agente sugeriu: "${a.sugestao_ia}"\n  Usuário enviou: "${a.resposta_real}"`

  const blocos: string[] = []
  if (discussao.length > 0) blocos.push(`⚠ REQUEREM DISCUSSÃO (${discussao.length}):\n${discussao.map(formatar).join("\n\n")}`)
  if (resto.length > 0)     blocos.push(`DEMAIS APRENDIZADOS (${resto.length}):\n${resto.map((a, i) => formatar(a, discussao.length + i)).join("\n\n")}`)

  return `═══ APRENDIZADOS PENDENTES (${aprendizados.length}) ═══\n${blocos.join("\n\n")}\n═══════════════════════\n\n`
})() : ""}
Seu papel nesta conversa:
1. Analisar o prompt base e os módulos existentes como um todo
2. Identificar lacunas, sobreposições ou oportunidades de melhoria
3. Sugerir novos módulos, reorganizações ou refinamentos de conteúdo
4. Escrever o conteúdo dos módulos quando solicitado
5. Raciocinar sobre quais gatilhos fazem mais sentido para cada módulo

Quando sugerir atualização do prompt base:
<<<PROMPT_ATUALIZADO>>>
[texto completo]
<<<FIM_PROMPT>>>

Quando sugerir um módulo novo ou atualizado:
<<<MODULO>>>
nome: [nome]
descricao: [para que serve]
gatilhos: [palavra1, palavra2, palavra3]
conteudo:
[texto completo do módulo]
<<<FIM_MODULO>>>

Seja direto e orientado a resultados. Pode ser crítico sobre a estrutura atual.`

    await query(
      `INSERT INTO lab.agente_refinamento (agente_id, role, content) VALUES ($1, 'user', $2)`,
      [id, message]
    )

    const messages = [
      ...historico.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: message },
    ]

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await apiRes.json() as { content?: { type: string; text: string }[]; error?: { message: string } }
    if (!apiRes.ok || !data.content) {
      const msg = data.error?.message ?? `HTTP ${apiRes.status}`
      return NextResponse.json({ error: `Erro na API Anthropic: ${msg}` }, { status: 502 })
    }
    const resposta = data.content.filter(b => b.type === "text").map(b => b.text).join("")

    await query(
      `INSERT INTO lab.agente_refinamento (agente_id, role, content) VALUES ($1, 'assistant', $2)`,
      [id, resposta]
    )

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

    return NextResponse.json({ resposta, promptSugerido, modulosSugeridos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  await query(`DELETE FROM lab.agente_refinamento WHERE agente_id = $1`, [id])
  return NextResponse.json({ ok: true })
}
