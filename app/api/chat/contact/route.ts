// app/api/chat/contact/route.ts
// Retorna foto de perfil (Evolution) + dados do cliente (js-painel)
// GET /api/chat/contact?jid=5551999887766@s.whatsapp.net

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface ContactInfo {
  // Perfil WhatsApp
  profile_pic_url: string | null
  phone: string

  // Cliente js-painel (null se não encontrado)
  cliente: {
    id_cliente: number
    nome: string
    score_fidelidade: number | null
    assinaturas: {
      id_assinatura: number
      status: string
      venc_contas: string | null
      venc_contrato: string | null
      identificacao: string | null
      plano: {
        tipo: string
        telas: number
        meses: number
        valor: number
        descricao: string | null
      } | null
      pacote: {
        contrato: string | null
        telas: number | null
      } | null
    }[]
  } | null
}

// Normaliza número: remove @s.whatsapp.net, remove 55 do início se tiver 13 dígitos
function normalizePhone(jid: string): string {
  const num = jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
  // Remove o 9 extra de números de SP/outros se tiver 13 dígitos com 55
  // Ex: 5551999887766 → busca por 5551999887766 e 551999887766
  return num
}

function phoneVariants(jid: string): string[] {
  const num = normalizePhone(jid)
  const variants = [num]

  // Sem 55: 5551999887766 → 51999887766
  if (num.startsWith("55") && num.length >= 12) {
    variants.push(num.slice(2))
  }
  // Com 55: 51999887766 → 5551999887766
  if (!num.startsWith("55") && num.length <= 11) {
    variants.push("55" + num)
  }
  return variants
}

export async function GET(req: NextRequest) {
  const jid = new URL(req.url).searchParams.get("jid")
  if (!jid) return NextResponse.json({ error: "jid obrigatório" }, { status: 400 })

  const phone = normalizePhone(jid)
  const variants = phoneVariants(jid)

  // 1. Busca foto de perfil na Evolution API
  let profilePicUrl: string | null = null
  try {
    const picRes = await fetch(
      `${process.env.EVOLUTION_URL}/chat/fetchProfilePictureUrl/${process.env.EVOLUTION_INSTANCE ?? "jsevolution"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! },
        body: JSON.stringify({ number: phone }),
      }
    )
    const picData = await picRes.json() as { profilePictureUrl?: string }
    profilePicUrl = picData?.profilePictureUrl ?? null
  } catch { /* sem foto */ }

  // 2. Busca cliente no js-painel pelo telefone
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(", ")

  type ClienteRow = {
    id_cliente: number
    nome: string
    score_fidelidade: number | null
    id_assinatura: number
    status: string
    venc_contas: string | null
    venc_contrato: string | null
    identificacao: string | null
    plano_tipo: string | null
    plano_telas: number | null
    plano_meses: number | null
    plano_valor: number | null
    plano_descricao: string | null
    pacote_contrato: string | null
    pacote_telas: number | null
  }

  const rows = await query<ClienteRow>(`
    SELECT
      c.id_cliente,
      c.nome,
      c.score_fidelidade,
      a.id_assinatura,
      a.status,
      a.venc_contas::text,
      a.venc_contrato::text,
      a.identificacao,
      pl.tipo          AS plano_tipo,
      pl.telas         AS plano_telas,
      pl.meses         AS plano_meses,
      pl.valor         AS plano_valor,
      pl.descricao     AS plano_descricao,
      pa.contrato      AS pacote_contrato,
      pa.telas         AS pacote_telas
    FROM public.contatos co
    JOIN public.clientes c  ON c.id_cliente  = co.id_cliente
    LEFT JOIN public.assinaturas a ON a.id_cliente = c.id_cliente
    LEFT JOIN public.planos pl     ON pl.id_plano  = a.id_plano
    LEFT JOIN public.pacote pa     ON pa.id_pacote = a.id_pacote
    WHERE co.telefone IN (${placeholders})
    ORDER BY a.status ASC, a.venc_contas DESC
    LIMIT 10
  `, variants).catch(() => [] as ClienteRow[])

  // Monta resposta
  let cliente: ContactInfo["cliente"] = null

  if (rows.length > 0) {
    const first = rows[0]
    cliente = {
      id_cliente:       first.id_cliente,
      nome:             first.nome,
      score_fidelidade: first.score_fidelidade ? Number(first.score_fidelidade) : null,
      assinaturas: rows
        .filter(r => r.id_assinatura)
        .map(r => ({
          id_assinatura: r.id_assinatura,
          status:        r.status,
          venc_contas:   r.venc_contas,
          venc_contrato: r.venc_contrato,
          identificacao: r.identificacao,
          plano: r.plano_tipo ? {
            tipo:      r.plano_tipo,
            telas:     r.plano_telas ?? 0,
            meses:     r.plano_meses ?? 0,
            valor:     Number(r.plano_valor ?? 0),
            descricao: r.plano_descricao,
          } : null,
          pacote: r.pacote_contrato || r.pacote_telas ? {
            contrato: r.pacote_contrato,
            telas:    r.pacote_telas,
          } : null,
        })),
    }
  }

  // Atualiza foto na tabela de conversas se encontrou
  if (profilePicUrl) {
    await query(
      `UPDATE lab.conversations SET profile_pic_url = $1 WHERE jid = $2`,
      [profilePicUrl, jid]
    ).catch(() => {})
  }

  return NextResponse.json({
    profile_pic_url: profilePicUrl,
    phone,
    cliente,
  } satisfies ContactInfo)
}
