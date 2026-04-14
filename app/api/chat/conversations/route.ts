// app/api/chat/conversations/route.ts
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface ConversationRow {
  jid: string
  instance: string
  profile_name: string | null
  profile_pic_url: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  is_client: boolean | null
  shadow_mode: boolean
  muted: boolean
  pinned: boolean
}

export async function GET() {
  try {
    const rows = await query<ConversationRow>(`
      SELECT jid, instance, profile_name, profile_pic_url,
             last_message, last_message_at, unread_count,
             is_client, shadow_mode, muted,
             COALESCE(pinned, FALSE) AS pinned
      FROM lab.conversations
      WHERE jid NOT LIKE '%@lid'
      ORDER BY COALESCE(pinned, FALSE) DESC, last_message_at DESC NULLS LAST
      LIMIT 100
    `)
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
