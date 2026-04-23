// app/api/evolution/webhook/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Aqui entra a lógica que já existia para processar os eventos
    // (mensagens recebidas, status, etc.)
    console.log("[Evolution Webhook]", JSON.stringify(body, null, 2))

    // TODO: processar body.event e encaminhar para a lógica do chat

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Evolution Webhook] Erro:", err)
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }
}