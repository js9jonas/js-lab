// app/api/evolution/webhook/route.ts
// Endpoint configurado na Evolution API para receber todos os eventos.
import { NextRequest, NextResponse } from "next/server"
import { handleWebhookPost } from "@/lib/webhook-handler"

export async function POST(req: NextRequest) {
  return handleWebhookPost(req)
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "js-lab webhook",
    timestamp: new Date().toISOString(),
  })
}
