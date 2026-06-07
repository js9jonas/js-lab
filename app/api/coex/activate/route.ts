// app/api/coex/activate/route.ts
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { code } = await req.json()

  if (!code) {
    return NextResponse.json({ error: "code obrigatório" }, { status: 400 })
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "META_APP_ID ou META_APP_SECRET não configurado" }, { status: 500 })
  }

  // Troca o code pelo access token
  const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token")
  tokenUrl.searchParams.set("client_id", appId)
  tokenUrl.searchParams.set("client_secret", appSecret)
  tokenUrl.searchParams.set("code", code)

  const tokenRes = await fetch(tokenUrl.toString())
  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("[coex/activate] erro ao trocar código:", tokenData)
    return NextResponse.json(
      { error: tokenData.error?.message ?? "Falha ao obter access token" },
      { status: 502 }
    )
  }

  const accessToken: string = tokenData.access_token

  // Busca os dados do número associado ao token (debug_token)
  const debugUrl = new URL("https://graph.facebook.com/v21.0/debug_token")
  debugUrl.searchParams.set("input_token", accessToken)
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`)

  const debugRes = await fetch(debugUrl.toString())
  const debugData = await debugRes.json()

  console.log("[coex/activate] debug_token:", JSON.stringify(debugData, null, 2))
  console.log("[coex/activate] access_token:", accessToken)

  // granular_scopes pode conter waba_id e phone_number_id
  const granularScopes: Array<{ scope: string; target_ids?: string[] }> =
    debugData.data?.granular_scopes ?? []

  const wabaScope = granularScopes.find((s) => s.scope === "whatsapp_business_management")
  const phoneScope = granularScopes.find((s) => s.scope === "whatsapp_business_messaging")

  const wabaId = wabaScope?.target_ids?.[0] ?? null
  const phoneNumberId = phoneScope?.target_ids?.[0] ?? null

  return NextResponse.json({
    ok: true,
    accessToken,
    wabaId,
    phoneNumberId,
  })
}
