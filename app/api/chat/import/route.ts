// app/api/chat/import/route.ts
// Importa conversas existentes da Evolution API para lab.conversations
// POST /api/chat/import  →  importa em lotes de 50

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(req: NextRequest) {
  const { limit = 200 } = await req.json().catch(() => ({})) as { limit?: number }

  const EVOLUTION_URL = process.env.EVOLUTION_URL!
  const EVOLUTION_KEY = process.env.EVOLUTION_KEY!
  const INSTANCE      = process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ limit }),
    })

    const chats = await res.json() as {
      remoteJid: string
      pushName: string | null
      name?: string | null        // nome do grupo (subject) no Baileys
      profilePicUrl: string | null
      updatedAt: string | null
      lastMessage?: {
        messageType?: string
        message?: Record<string, unknown>
        pushName?: string
      }
    }[]

    if (!Array.isArray(chats)) {
      return NextResponse.json({ error: "Resposta inesperada da Evolution", raw: chats }, { status: 500 })
    }

    // Filtra status broadcast — inclui contatos (@s.whatsapp.net) e grupos (@g.us)
    const individual = chats.filter(c =>
      c.remoteJid.endsWith("@s.whatsapp.net") || c.remoteJid.endsWith("@g.us")
    )

    let imported = 0
    let skipped  = 0

    for (const chat of individual) {
      // Extrai preview da última mensagem
      const lastMsg = chat.lastMessage
      let preview: string | null = null
      if (lastMsg?.message) {
        const m = lastMsg.message as Record<string, unknown>
        preview =
          (m.conversation as string) ??
          ((m.extendedTextMessage as Record<string, unknown>)?.text as string) ??
          ((m.imageMessage as Record<string, unknown>)?.caption as string) ??
          lastMsg.messageType ?? null
      }

      const result = await query(`
        INSERT INTO lab.conversations (jid, instance, profile_name, profile_pic_url, last_message, last_message_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (jid) DO UPDATE SET
          profile_name    = COALESCE($3, lab.conversations.profile_name),
          profile_pic_url = COALESCE($4, lab.conversations.profile_pic_url),
          last_message    = COALESCE($5, lab.conversations.last_message),
          last_message_at = COALESCE($6, lab.conversations.last_message_at),
          updated_at      = NOW()
        WHERE lab.conversations.last_message_at IS NULL
           OR $6 > lab.conversations.last_message_at
      `, [
        chat.remoteJid,
        INSTANCE,
        chat.name ?? chat.pushName ?? null,
        chat.profilePicUrl ?? null,
        preview,
        chat.updatedAt ?? null,
      ])

      if ((result as unknown as { rowCount: number }).rowCount > 0) imported++
      else skipped++
    }

    return NextResponse.json({
      ok: true,
      total: individual.length,
      imported,
      skipped,
    })

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
