// app/api/agenda/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const body = await req.json()
  const {
    titulo, descricao, data, hora, hora_fim,
    local, id_categoria, epoca_costume, observacoes, ativo
  } = body

  await pool.query(
    `UPDATE lab.eventos SET
      titulo        = $1,
      descricao     = $2,
      data          = $3,
      hora          = NULLIF($4,'')::time,
      hora_fim      = NULLIF($5,'')::time,
      local         = NULLIF($6,''),
      id_categoria  = $7,
      epoca_costume = NULLIF($8,''),
      observacoes   = NULLIF($9,''),
      ativo         = $10,
      atualizado_em = NOW()
    WHERE id = $11`,
    [
      titulo,
      descricao || null,
      data,
      hora || '',
      hora_fim || '',
      local || '',
      id_categoria || null,
      epoca_costume || '',
      observacoes || '',
      ativo ?? true,
      id,
    ]
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params

  await pool.query("DELETE FROM lab.eventos WHERE id = $1", [id])

  return NextResponse.json({ ok: true })
}