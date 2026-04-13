// app/api/chat/send/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function POST(req: NextRequest) {
  const { jid, text, instance, quoted, quotedSenderName } = await req.json() as {
    jid: string
    text: string
    instance?: string
    quoted?: { key: { remoteJid: string; fromMe: boolean; id: string }; message: Record<string, unknown> }
    quotedSenderName?: string
  }

  const INSTANCE = instance ?? process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  try {
    // Envia pela Evolution API
    const body: Record<string, unknown> = { number: jid, text }
    if (quoted) body.quoted = quoted

    const res = await fetch(
      `${process.env.EVOLUTION_URL}/message/sendText/${INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_KEY!,
        },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json() as { key?: { id?: string } }
    const msgId = data?.key?.id ?? `local_${Date.now()}`

    // Monta raw com contextInfo embutido quando for reply (para exibir bloco de citação ao recarregar)
    const rawToStore = quoted
      ? {
          ...data,
          message: {
            extendedTextMessage: {
              text,
              contextInfo: {
                stanzaId: quoted.key.id,
                participant: quoted.key.remoteJid,
                quotedMessage: quoted.message,
                _quotedSenderName: quotedSenderName ?? "",
              },
            },
          },
        }
      : data

    const msgType = quoted ? "extendedTextMessage" : "conversation"

    // Persiste no banco local
    await query(`
      INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, status, timestamp, raw)
      VALUES ($1,$2,$3,true,$4,$5,'SENT',NOW(),$6)
      ON CONFLICT (id) DO NOTHING
    `, [msgId, jid, INSTANCE, msgType, text, JSON.stringify(rawToStore)])

    // Atualiza preview da conversa
    await query(`
      INSERT INTO lab.conversations (jid, instance, last_message, last_message_at)
      VALUES ($1,$2,$3,NOW())
      ON CONFLICT (jid) DO UPDATE SET
        last_message = $3,
        last_message_at = NOW(),
        updated_at = NOW()
    `, [jid, INSTANCE, text])

    return NextResponse.json({ ok: true, id: msgId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
