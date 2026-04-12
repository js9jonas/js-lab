import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { instance, jid, messageId, fromMe, reaction } =
    await req.json() as {
      instance: string
      jid: string
      messageId: string
      fromMe: boolean
      reaction: string // emoji ou "" para remover
    }

  if (!instance || !jid || !messageId)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const INSTANCE = instance ?? process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  try {
    const res = await fetch(
      `${process.env.EVOLUTION_URL}/message/sendReaction/${INSTANCE}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({
          key: { remoteJid: jid, fromMe, id: messageId },
          reaction,
        }),
      }
    )

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `Evolution retornou ${res.status}: ${txt}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
