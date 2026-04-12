import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

const MAX_SIZE_BYTES = 500 * 1024 // 500 KB

export async function POST(req: NextRequest) {
  const { instance, jid, stickerBase64 } =
    await req.json() as { instance: string; jid: string; stickerBase64: string }

  if (!instance || !jid || !stickerBase64)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const estimatedBytes = Math.ceil((stickerBase64.length * 3) / 4)
  if (estimatedBytes > MAX_SIZE_BYTES)
    return NextResponse.json({ error: "Sticker maior que 500 KB" }, { status: 400 })

  const INSTANCE = instance ?? process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  try {
    const res = await fetch(
      `${process.env.EVOLUTION_URL}/message/sendMedia/${INSTANCE}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({
          number: jid,
          mediatype: "sticker",
          media: stickerBase64,
        }),
      }
    )

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Evolution retornou ${res.status}: ${txt}` }, { status: 502 })
    }

    const data = await res.json() as { key?: { id?: string } }
    const msgId = data?.key?.id ?? `local_${Date.now()}`

    await query(`
      INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, status, timestamp, raw)
      VALUES ($1,$2,$3,true,'stickerMessage',null,'SENT',NOW(),$4)
      ON CONFLICT (id) DO NOTHING
    `, [msgId, jid, INSTANCE, JSON.stringify(data)])

    await query(`
      INSERT INTO lab.conversations (jid, instance, last_message, last_message_at)
      VALUES ($1,$2,'🗒️ Sticker',NOW())
      ON CONFLICT (jid) DO UPDATE SET
        last_message = '🗒️ Sticker',
        last_message_at = NOW(),
        updated_at = NOW()
    `, [jid, INSTANCE])

    return NextResponse.json({ ok: true, id: msgId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
