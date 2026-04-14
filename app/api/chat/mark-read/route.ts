// app/api/chat/mark-read/route.ts
// Marca conversa como lida: zera unread_count no banco e avisa a Evolution API
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { jid, instance } = await req.json() as { jid: string; instance: string }
  if (!jid || !instance) return NextResponse.json({ error: "jid e instance obrigatórios" }, { status: 400 })

  // 1. Zera unread_count no banco
  await query(
    `UPDATE lab.conversations SET unread_count = 0 WHERE jid = $1`,
    [jid]
  ).catch(console.error)

  // 2. Avisa a Evolution API para enviar read receipt
  try {
    const EVOLUTION_URL = process.env.EVOLUTION_URL!
    const EVOLUTION_KEY = process.env.EVOLUTION_KEY!
    await fetch(`${EVOLUTION_URL}/chat/markMessageAsRead/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ read_messages: [{ remoteJid: jid, fromMe: false, id: "0" }] }),
    })
  } catch { /* silencioso — não bloqueia o UI */ }

  return NextResponse.json({ ok: true })
}
