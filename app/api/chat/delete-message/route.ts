import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { instance, jid, messageId, fromMe } =
    await req.json() as { instance: string; jid: string; messageId: string; fromMe: boolean }

  if (!instance || !jid || !messageId)
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const INSTANCE = instance ?? process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  // Deleta do banco local PRIMEIRO
  await query(`DELETE FROM lab.messages WHERE id = $1`, [messageId]).catch(() => {})

  // Tenta revogar no WhatsApp — loga a resposta para diagnóstico
  let evolutionStatus: number | null = null
  let evolutionBody: unknown = null
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_URL}/chat/deleteMessageForEveryone/${INSTANCE}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({ id: messageId, remoteJid: jid, fromMe }),
      }
    )
    evolutionStatus = res.status
    evolutionBody   = await res.json().catch(() => null)
    console.log(`[delete-message] Evolution status=${res.status}`, evolutionBody)
  } catch (err) {
    console.error("[delete-message] Evolution fetch error:", err)
    evolutionBody = String(err)
  }

  return NextResponse.json({ ok: true, evolutionStatus, evolutionBody })
}
