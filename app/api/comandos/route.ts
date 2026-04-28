import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS lab.comandos (
      id            SERIAL PRIMARY KEY,
      trigger       TEXT NOT NULL UNIQUE,
      descricao     TEXT NOT NULL DEFAULT '',
      resposta      TEXT NOT NULL DEFAULT '',
      ativo         BOOLEAN NOT NULL DEFAULT true,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await query(`
    INSERT INTO lab.comandos (trigger, descricao, resposta) VALUES
      ('/info',   'Dados de assinatura do cliente',      '📋 *Seus dados*\n\nAinda não integrado com o banco.\nEm desenvolvimento. 🔧'),
      ('/status', 'Status do sistema',                   '🟢 *JS Lab online*\n\nWebhook ativo | Evolution API conectada'),
      ('/ajuda',  'Lista de comandos disponíveis',       '📌 *Comandos disponíveis:*\n\n/info — seus dados de assinatura\n/status — status do sistema\n/ajuda — esta mensagem'),
      ('/help',   'Alias para /ajuda',                   '📌 *Comandos disponíveis:*\n\n/info — seus dados de assinatura\n/status — status do sistema\n/ajuda — esta mensagem')
    ON CONFLICT (trigger) DO NOTHING
  `)
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, trigger, descricao, resposta, ativo, criado_em, atualizado_em
       FROM lab.comandos ORDER BY trigger`
    )
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; descricao?: string; resposta?: string; ativo?: boolean }
    if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })

    const sets: string[] = ["atualizado_em = NOW()"]
    const params: unknown[] = []
    let i = 1

    if (body.descricao !== undefined) { sets.push(`descricao = $${i++}`); params.push(body.descricao) }
    if (body.resposta  !== undefined) { sets.push(`resposta = $${i++}`);  params.push(body.resposta)  }
    if (body.ativo     !== undefined) { sets.push(`ativo = $${i++}`);     params.push(body.ativo)     }

    params.push(body.id)
    await query(`UPDATE lab.comandos SET ${sets.join(", ")} WHERE id = $${i}`, params)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { trigger: string; descricao: string; resposta: string }
    if (!body.trigger?.trim()) return NextResponse.json({ error: "trigger obrigatório" }, { status: 400 })
    await ensureTable()
    await query(
      `INSERT INTO lab.comandos (trigger, descricao, resposta) VALUES ($1, $2, $3)`,
      [body.trigger.trim().toLowerCase(), body.descricao ?? "", body.resposta ?? ""]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 })
    await query(`DELETE FROM lab.comandos WHERE id = $1`, [Number(id)])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
