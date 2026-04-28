import { NextResponse } from "next/server"

export async function GET() {
  const url = process.env.EVOLUTION_URL
  const key = process.env.EVOLUTION_KEY
  const instance = process.env.EVOLUTION_INSTANCE ?? "jsevolution"

  const info: Record<string, unknown> = {
    EVOLUTION_URL: url ?? "(não definida)",
    EVOLUTION_KEY: key ? `${key.slice(0, 6)}...` : "(não definida)",
    EVOLUTION_INSTANCE: instance,
  }

  if (!url || !key) {
    return NextResponse.json({ ...info, erro: "Variáveis de ambiente ausentes" }, { status: 500 })
  }

  try {
    const res = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { apikey: key },
    })
    const body = await res.text()
    info.status_http = res.status
    info.resposta = body
  } catch (err) {
    info.erro_fetch = String(err)
  }

  // Testa sendText com número inválido só para ver o formato do erro
  try {
    const res = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({ number: "0000000000", text: "diag" }),
    })
    const body = await res.text()
    info.send_status = res.status
    info.send_resposta = body
  } catch (err) {
    info.send_erro = String(err)
  }

  return NextResponse.json(info)
}
