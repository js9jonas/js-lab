// app/api/chat/transcribe/route.ts
// Transcrição manual de áudio — chamada pelo botão na UI

import { NextRequest, NextResponse } from "next/server"
import { transcribeAudio } from "@/lib/transcribe"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { messageId, jid, instance } = await req.json() as {
      messageId: string
      jid: string
      instance: string
    }

    if (!messageId || !jid || !instance) {
      return NextResponse.json({ error: "messageId, jid e instance são obrigatórios" }, { status: 400 })
    }

    const result = await transcribeAudio(messageId, jid, instance)

    if (!result.ok) {
      console.error(`[transcribe] erro: ${result.error} | messageId=${messageId}`)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ transcricao: result.transcricao })
  } catch (err) {
    console.error("[transcribe] exceção não tratada:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
