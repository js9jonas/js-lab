// app/api/chat/sugestao/route.ts
// Gera sugestão de resposta para o modo sombra
// Suporta: texto, imagem (Claude Vision), áudio (sugestão genérica)

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

// ─── Lookup de cliente pelo JID ───────────────────────────────────────────────

function normalizePhone(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
}

function phoneVariants(jid: string): string[] {
  const num = normalizePhone(jid)
  const variants = [num]
  if (num.startsWith("55") && num.length >= 12) variants.push(num.slice(2))
  if (!num.startsWith("55") && num.length <= 11) variants.push("55" + num)
  return variants
}

async function buildClienteContext(jid: string): Promise<string> {
  if (!jid.endsWith("@s.whatsapp.net")) return ""

  const variants = phoneVariants(jid)
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(", ")

  type ClienteRow = {
    id_cliente: number
    nome: string
    score_fidelidade: number | null
    id_assinatura: number | null
    status: string | null
    venc_contas: string | null
    venc_contrato: string | null
    identificacao: string | null
    plano_tipo: string | null
    plano_telas: number | null
    plano_meses: number | null
    plano_valor: number | null
    nome_app: string | null
    app_status: string | null
    app_validade: string | null
  }

  const rows = await query<ClienteRow>(`
    SELECT DISTINCT ON (c.id_cliente, a.id_assinatura, ar.id_app_registro)
      c.id_cliente, c.nome, c.score_fidelidade,
      a.id_assinatura, a.status, a.venc_contas::text, a.venc_contrato::text, a.identificacao,
      pl.tipo AS plano_tipo, pl.telas AS plano_telas, pl.meses AS plano_meses, pl.valor AS plano_valor,
      ap.nome_app, ar.status AS app_status, ar.validade::text AS app_validade
    FROM public.contatos co
    JOIN public.clientes c ON c.id_cliente = co.id_cliente
    LEFT JOIN public.assinaturas a ON a.id_cliente = c.id_cliente
    LEFT JOIN public.planos pl ON pl.id_plano = a.id_plano
    LEFT JOIN public.aplicativos ar ON ar.id_cliente = c.id_cliente
    LEFT JOIN public.apps ap ON ap.id_app = ar.id_app
    WHERE co.telefone IN (${placeholders})
    ORDER BY c.id_cliente, a.id_assinatura, ar.id_app_registro
    LIMIT 30
  `, variants).catch(() => [] as ClienteRow[])

  if (rows.length === 0) return ""

  // Agrupa por cliente (pode haver mais de um no mesmo número)
  const clientes = new Map<number, {
    nome: string
    score: number | null
    assinaturas: Set<string>
    apps: Set<string>
  }>()

  for (const r of rows) {
    if (!clientes.has(r.id_cliente)) {
      clientes.set(r.id_cliente, { nome: r.nome, score: r.score_fidelidade ? Number(r.score_fidelidade) : null, assinaturas: new Set(), apps: new Set() })
    }
    const c = clientes.get(r.id_cliente)!
    if (r.id_assinatura && r.status) {
      const plano = r.plano_tipo
        ? `${r.plano_tipo} ${r.plano_telas}t/${r.plano_meses}m R$${Number(r.plano_valor ?? 0).toFixed(0)}`
        : ""
      const venc = r.venc_contas ? ` venc.${r.venc_contas.slice(0, 10)}` : ""
      const id = r.identificacao ? ` (${r.identificacao})` : ""
      c.assinaturas.add(`[${r.status.toUpperCase()}]${id} ${plano}${venc}`.trim())
    }
    if (r.nome_app && r.app_status) {
      const val = r.app_validade ? ` val.${r.app_validade.slice(0, 10)}` : ""
      c.apps.add(`${r.nome_app} [${r.app_status}]${val}`)
    }
  }

  const linhas: string[] = ["[DADOS DO CLIENTE]"]
  for (const [, c] of clientes) {
    linhas.push(`Cliente: ${c.nome}${c.score != null ? ` | Score: ${c.score}` : ""}`)
    if (c.assinaturas.size > 0) linhas.push(`Assinaturas: ${[...c.assinaturas].join(" | ")}`)
    if (c.apps.size > 0) linhas.push(`Apps: ${[...c.apps].join(" | ")}`)
  }

  return "\n\n" + linhas.join("\n")
}

// Baixa mídia da Evolution e retorna base64
async function getMediaBase64(instance: string, messageId: string): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
      }
    )
    const data = await res.json() as { base64?: string; mimetype?: string }
    if (!data.base64) return null
    return { base64: data.base64, mimetype: data.mimetype ?? "image/jpeg" }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const { jid, instance, apenas_id, forcar } = await req.json() as {
    jid: string
    instance: string
    apenas_id?: boolean  // só retorna o agente_id sem gerar sugestão
    forcar?: boolean     // ignora verificação da última mensagem ser do cliente
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

    if (!agente) return NextResponse.json({ sugestao: null, motivo: "sem_agente" })
    if (apenas_id) return NextResponse.json({ agente_id: agente.id })

    // 2. Mensagens do dia atual
    const mensagensDia = await query<{
      id: string; from_me: boolean; content: string | null
      message_type: string; timestamp: string; raw: unknown
    }>(
      `SELECT id, from_me, content, message_type, timestamp, raw
       FROM lab.messages
       WHERE jid = $1
         AND timestamp >= CURRENT_DATE AND timestamp < CURRENT_DATE + INTERVAL '1 day'
       ORDER BY timestamp ASC`,
      [jid]
    )

    if (mensagensDia.length === 0) {
      return NextResponse.json({ sugestao: null, motivo: "sem_mensagens_hoje" })
    }

    const ultima = mensagensDia[mensagensDia.length - 1]

    // Verifica se a última mensagem é do cliente (a não ser que seja forçado)
    if (!forcar && ultima.from_me) {
      return NextResponse.json({ sugestao: null, motivo: "ultima_e_minha" })
    }

    // 3. Busca módulos relevantes
    const textoRecente = mensagensDia
      .filter(m => !m.from_me && m.content)
      .slice(-3).map(m => m.content ?? "").join(" ").toLowerCase()

    const modulos = await query<{ nome: string; conteudo: string; gatilhos: string[] }>(
      `SELECT nome, conteudo, gatilhos FROM lab.agente_modulos
       WHERE agente_id = $1 AND ativo = true ORDER BY ordem ASC`,
      [agente.id]
    )

    const modulosAtivos = (modulos ?? []).filter(m =>
      m.gatilhos.length === 0 ||
      m.gatilhos.some(g => textoRecente.includes(g.toLowerCase()))
    )

    const modulosTexto = modulosAtivos.length > 0
      ? "\n\n" + modulosAtivos.map(m => `[${m.nome.toUpperCase()}]\n${m.conteudo}`).join("\n\n---\n\n")
      : ""

    const clienteCtx = await buildClienteContext(jid)

    const systemPrompt =
      agente.prompt_atual +
      modulosTexto +
      clienteCtx +
      "\n\n---\nResponda com JSON válido neste formato exato:\n{\"raciocinio\": \"análise interna em 1-2 frases: o que você percebeu no contexto e por que esta resposta\", \"resposta\": \"mensagem a enviar ao cliente\"}\nSem texto fora do JSON. O campo raciocinio NÃO é enviado ao cliente."

    // ── Áudio: usa transcrição se disponível, senão resposta genérica ────────
    if (ultima.message_type === "audioMessage" && !ultima.content) {
      return NextResponse.json({
        sugestao: "Recebi seu áudio! Vou ouvir e já te retorno 😊",
        agente_id: agente.id,
        agente_nome: agente.nome,
        tipo: "audio_generico",
      })
    }

    // 4. Monta histórico de mensagens para a API
    // Para imagens na última mensagem, baixa o base64 para o Claude ver
    type ApiMessage = {
      role: "user" | "assistant"
      content: string | { type: string; source?: unknown; text?: string }[]
    }
    const rawMessages: ApiMessage[] = []

    for (const m of mensagensDia) {
      const role = m.from_me ? "assistant" : "user"
      const isUltima = m.id === ultima.id
      const isImagem = m.message_type === "imageMessage"

      // Última mensagem sendo imagem → envia com Vision
      if (isUltima && isImagem) {
        const caption = m.content ?? ""
        const media = await getMediaBase64(instance, m.id)

        if (media) {
          const contentParts: { type: string; source?: unknown; text?: string }[] = [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: media.mimetype,
                data: media.base64,
              },
            },
          ]
          if (caption) contentParts.push({ type: "text", text: caption })
          rawMessages.push({ role: "user", content: contentParts })
        } else {
          rawMessages.push({ role, content: caption || "[imagem]" })
        }
        continue
      }

      // Imagens anteriores (não a última) → só caption ou placeholder
      if (isImagem) {
        rawMessages.push({ role, content: m.content ?? "[imagem]" })
        continue
      }

      // Áudio com transcrição
      if (m.message_type === "audioMessage") {
        const texto = m.content ? `[áudio] ${m.content}` : "[áudio sem transcrição]"
        rawMessages.push({ role, content: texto })
        continue
      }

      // Texto normal
      rawMessages.push({ role, content: m.content ?? `[${m.message_type}]` })
    }

    // Mescla mensagens consecutivas do mesmo papel (API exige alternância user/assistant)
    const messages: ApiMessage[] = []
    for (const msg of rawMessages) {
      const prev = messages[messages.length - 1]
      if (prev && prev.role === msg.role && typeof prev.content === "string" && typeof msg.content === "string") {
        prev.content += "\n" + msg.content
      } else {
        messages.push({ ...msg })
      }
    }
    // API não aceita primeira mensagem como "assistant"
    while (messages.length > 0 && messages[0].role === "assistant") {
      messages.shift()
    }
    // API não aceita última mensagem como "assistant" — adiciona instrução de follow-up
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      messages.push({ role: "user", content: "[O atendente quer enviar uma mensagem de follow-up. Sugira o que ele deve dizer agora.]" })
    }

    // 5. Chama Claude
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await apiRes.json() as { content?: { type: string; text: string }[]; error?: { message: string } }
    if (!apiRes.ok || !data.content) {
      const msg = data.error?.message ?? `HTTP ${apiRes.status}`
      return NextResponse.json({ error: `Erro na API: ${msg}` }, { status: 502 })
    }
    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("").trim()

    let sugestao = raw
    let raciocinio: string | null = null
    try {
      // extrai o JSON mesmo que haja texto antes/depois (alguns modelos adicionam markdown)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as { raciocinio?: string; resposta?: string }
        sugestao   = parsed.resposta?.trim()   ?? raw
        raciocinio = parsed.raciocinio?.trim() ?? null
      }
    } catch { /* fallback: usa o texto bruto como sugestão */ }

    return NextResponse.json({
      sugestao,
      raciocinio,
      agente_id: agente.id,
      agente_nome: agente.nome,
      tipo: ultima.message_type === "imageMessage" ? "imagem" : "texto",
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}