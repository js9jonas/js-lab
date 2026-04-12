import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { instance, messageId } = await req.json() as { instance: string; messageId: string }

  if (!instance || !messageId) {
    return NextResponse.json({ error: "instance e messageId são obrigatórios" }, { status: 400 })
  }

  const EVOLUTION_URL = process.env.EVOLUTION_URL!
  const EVOLUTION_KEY = process.env.EVOLUTION_KEY!

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(
      `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
        body: JSON.stringify({ message: { key: { id: messageId } } }),
        signal: controller.signal,
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Evolution retornou ${res.status}` }, { status: 502 })
    }

    const data = await res.json() as { base64?: string; mimetype?: string }

    if (!data.base64) {
      return NextResponse.json({ error: "base64 não retornado pela Evolution" }, { status: 502 })
    }

    return NextResponse.json({ base64: data.base64, mimetype: data.mimetype ?? "application/octet-stream" })

  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json({ error: "Timeout ao buscar mídia" }, { status: 504 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    clearTimeout(timeout)
  }
}
