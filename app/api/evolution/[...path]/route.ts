// app/api/evolution/[...path]/route.ts
// Proxy para a Evolution API — evita CORS na interface do lab
// Migrado do js-painel

import { NextRequest, NextResponse } from "next/server"

const EVOLUTION_URL = process.env.EVOLUTION_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_KEY!

async function proxy(req: NextRequest, pathArr: string[], method: string, body?: string) {
  const url = `${EVOLUTION_URL}/${pathArr.join("/")}`
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
    body: body || undefined,
  })
  const data = await res.json()
  return NextResponse.json(data)
}

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params
  return proxy(req, path, "GET")
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params
  return proxy(req, path, "POST", await req.text())
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params
  return proxy(req, path, "DELETE")
}
