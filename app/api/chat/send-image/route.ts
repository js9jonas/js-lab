import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 16 * 1024 * 1024 // 16 MB

export async function POST(req: NextRequest) {
  const { instance, jid, imageBase64, mimetype, caption } =
    await req.json() as {
      instance: string
      jid: string
      imageBase64: string
      mimetype: string
      caption?: string
    }

  if (!instance || !jid || !imageBase64 || !mimetype)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  if (!ALLOWED_MIMETYPES.includes(mimetype))
    return NextResponse.json({ error: "Tipo de imagem não suportado" }, { status: 400 })

  // Verifica tamanho pelo base64 (base64 ≈ 4/3 do tamanho real)
  const estimatedBytes = Math.ceil((imageBase64.length * 3) / 4)
  if (estimatedBytes > MAX_SIZE_BYTES)
    return NextResponse.json({ error: "Imagem maior que 16 MB" }, { status: 400 })

  const INSTANCE = instance ?? process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  try {
    const res = await fetch(
      `${process.env.EVOLUTION_URL}/message/sendMedia/${INSTANCE}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({
          number: jid,
          mediatype: "image",
          media: imageBase64,
          caption: caption ?? "",
        }),
      }
    )

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Evolution retornou ${res.status}: ${txt}` }, { status: 502 })
    }

    const data = await res.json() as { key?: { id?: string } }
    const msgId = data?.key?.id ?? `local_${Date.now()}`

    // Persiste no banco local
    await query(`
      INSERT INTO lab.messages (id, jid, instance, from_me, message_type, content, status, timestamp, raw)
      VALUES ($1,$2,$3,true,'imageMessage',$4,'SENT',NOW(),$5)
      ON CONFLICT (id) DO NOTHING
    `, [msgId, jid, INSTANCE, caption ?? null, JSON.stringify(data)])

    // Atualiza preview da conversa
    await query(`
      INSERT INTO lab.conversations (jid, instance, last_message, last_message_at)
      VALUES ($1,$2,'🖼 Imagem',NOW())
      ON CONFLICT (jid) DO UPDATE SET
        last_message = '🖼 Imagem',
        last_message_at = NOW(),
        updated_at = NOW()
    `, [jid, INSTANCE])

    return NextResponse.json({ ok: true, id: msgId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
