import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface GroupMetadata {
  subject: string
  subjectOwner?: string
  subjectTime?: number
  pictureUrl?: string | null
  participantsCount: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const instance = searchParams.get("instance")
  const jid      = searchParams.get("jid")

  if (!instance || !jid)
    return NextResponse.json({ error: "instance e jid são obrigatórios" }, { status: 400 })

  const EVOLUTION_URL = process.env.EVOLUTION_URL!
  const EVOLUTION_KEY = process.env.EVOLUTION_KEY!

  try {
    // 1. Busca metadados do grupo
    const res = await fetch(
      `${EVOLUTION_URL}/group/findGroupInfos/${instance}?groupJid=${encodeURIComponent(jid)}`,
      { headers: { apikey: EVOLUTION_KEY } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Evolution retornou ${res.status}` }, { status: 502 })
    }

    const data = await res.json() as {
      subject?: string
      subjectOwner?: string
      subjectTime?: number
      participants?: unknown[]
      pictureUrl?: string | null
    }

    const subject          = data.subject ?? ""
    const participantsCount = Array.isArray(data.participants) ? data.participants.length : 0
    const pictureUrl       = data.pictureUrl ?? null

    // 2. Persiste profile_name se ainda não estava salvo
    if (subject) {
      await query(`
        UPDATE lab.conversations
        SET profile_name = $1, updated_at = NOW()
        WHERE jid = $2 AND (profile_name IS NULL OR profile_name = '')
      `, [subject, jid]).catch(() => {})
    }

    const result: GroupMetadata = {
      subject,
      subjectOwner: data.subjectOwner,
      subjectTime:  data.subjectTime,
      pictureUrl,
      participantsCount,
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
