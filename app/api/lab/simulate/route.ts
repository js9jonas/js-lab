// app/api/lab/simulate/route.ts
// Permite testar o classificador + handlers pela interface do lab
// dryRun=true por padrão: classifica e executa lógica, mas NÃO envia mensagem

import { NextRequest, NextResponse } from "next/server"
import type { EvolutionPayload, SimulateInput } from "@/lib/types"
import { classify, extractText } from "@/lib/classifier"
import { dispatch } from "@/lib/dispatcher"

export async function POST(req: NextRequest) {
  const body: SimulateInput = await req.json()
  const dryRun = body.dryRun !== false // true por padrão

  // Monta um payload mínimo válido
  const payload: EvolutionPayload = {
    event: "messages.upsert",
    instance: process.env.EVOLUTION_INSTANCE ?? "jsevolution",
    date_time: new Date().toISOString(),
    server_url: process.env.EVOLUTION_URL ?? "",
    ...body.payload,
    data: {
      key: {
        remoteJid: "5500000000000@s.whatsapp.net",
        fromMe: false,
        id: "SIM_" + Date.now(),
      },
      message: {},
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
      ...(body.payload?.data ?? {}),
    },
  }

  const text = extractText(payload)
  const classification = classify(payload)
  const result = await dispatch(payload, classification, dryRun)

  return NextResponse.json({
    input: { text, messageType: payload.data.messageType, fromMe: payload.data.key.fromMe },
    classification,
    result,
    dryRun,
  })
}
