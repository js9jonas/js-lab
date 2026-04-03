// app/api/chat/sugestao/route.ts
// Gera sugestão de resposta para o modo sombra
// Suporta: texto, imagem (Claude Vision), áudio (sugestão genérica)

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

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
         AND DATE(timestamp AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'
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

    const modulosAtivos = modulos.filter(m =>
      m.gatilhos.length === 0 ||
      m.gatilhos.some(g => textoRecente.includes(g.toLowerCase()))
    )

    const modulosTexto = modulosAtivos.length > 0
      ? "\n\n" + modulosAtivos.map(m => `[${m.nome.toUpperCase()}]\n${m.conteudo}`).join("\n\n---\n\n")
      : ""

    const systemPrompt =
      agente.prompt_atual +
      modulosTexto +
      "\n\n---\nResponda APENAS com o texto da mensagem, sem explicações, sem aspas, sem formatação extra. Será enviado diretamente ao cliente."

    // ── Áudio: sugestão genérica sem chamar a API ────────────────────────────
    if (ultima.message_type === "audioMessage") {
      return NextResponse.json({
        sugestao: "Recebi seu áudio! Vou ouvir e já te retorno 😊",
        agente_id: agente.id,
        agente_nome: agente.nome,
        tipo: "audio_generico",
      })
    }

    // 4. Monta histórico de mensagens para a API
    // Para imagens na última mensagem, baixa o base64 para o Claude ver
    const messages: {
      role: "user" | "assistant"
      content: string | { type: string; source?: unknown; text?: string }[]
    }[] = []

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
          messages.push({ role: "user", content: contentParts })
        } else {
          // Fallback se não conseguir baixar a imagem
          messages.push({ role, content: caption || "[imagem]" })
        }
        continue
      }

      // Imagens anteriores (não a última) → só caption ou placeholder
      if (isImagem) {
        messages.push({ role, content: m.content ?? "[imagem]" })
        continue
      }

      // Texto normal
      messages.push({ role, content: m.content ?? `[${m.message_type}]` })
    }

    // 5. Chama Claude
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await apiRes.json() as { content: { type: string; text: string }[] }
    const sugestao = data.content
      .filter(b => b.type === "text")
      .map(b => b.text).join("").trim()

    return NextResponse.json({
      sugestao,
      agente_id: agente.id,
      agente_nome: agente.nome,
      tipo: ultima.message_type === "imageMessage" ? "imagem" : "texto",
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}