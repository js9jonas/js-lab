// app/api/chat/contact/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

export interface ContactInfo {
  profile_pic_url: string | null
  phone: string
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
      plano: { tipo: string; telas: number; meses: number; valor: number; descricao: string | null } | null
      pacote: { contrato: string | null; telas: number | null } | null
    }[]
    aplicativos: {
      id_app_registro: number
      nome_app: string
      chave: string
      mac: string | null
      validade: string | null
      status: string
      observacao: string | null
    }[]
    indicacoes: {
      id_indicacao: number
      tipo: "fez" | "recebeu"
      id_outro_cliente: number
      nome_outro_cliente: string
      telefone_outro_cliente: string | null
      jid_outro_cliente: string | null
      bonificacao: string | null
      status_indicacao: string | null
      criado_em: string
    }[]
  } | null
}

function normalizePhone(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
}

function phoneVariants(jid: string): string[] {
  const num = normalizePhone(jid)
  const variants = [num]
  if (num.startsWith("55") && num.length >= 12) variants.push(num.slice(2))
  if (!num.startsWith("55") && num.length <= 11) variants.push("55" + num)
  return variants
}

export async function GET(req: NextRequest) {
  const jid = new URL(req.url).searchParams.get("jid")
  if (!jid) return NextResponse.json({ error: "jid obrigatório" }, { status: 400 })

  const phone    = normalizePhone(jid)
  const variants = phoneVariants(jid)

  // 1. Foto de perfil
  let profilePicUrl: string | null = null
  try {
    const picRes = await fetch(
      `${process.env.EVOLUTION_URL}/chat/fetchProfilePictureUrl/${process.env.EVOLUTION_INSTANCE ?? "jsevolution"}`,
      { method: "POST", headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_KEY! }, body: JSON.stringify({ number: phone }) }
    )
    const picData = await picRes.json() as { profilePictureUrl?: string }
    profilePicUrl = picData?.profilePictureUrl ?? null
  } catch { /* sem foto */ }

  // 2. Dados do cliente
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(", ")

  type AssinaturaRow = {
    id_cliente: number; nome: string; score_fidelidade: number | null
    id_assinatura: number; status: string; venc_contas: string | null
    venc_contrato: string | null; identificacao: string | null
    plano_tipo: string | null; plano_telas: number | null; plano_meses: number | null
    plano_valor: number | null; plano_descricao: string | null
    pacote_contrato: string | null; pacote_telas: number | null
  }

  const assinaturaRows = await query<AssinaturaRow>(`
    SELECT c.id_cliente, c.nome, c.score_fidelidade,
           a.id_assinatura, a.status, a.venc_contas::text, a.venc_contrato::text, a.identificacao,
           pl.tipo AS plano_tipo, pl.telas AS plano_telas, pl.meses AS plano_meses,
           pl.valor AS plano_valor, pl.descricao AS plano_descricao,
           pa.contrato AS pacote_contrato, pa.telas AS pacote_telas
    FROM public.contatos co
    JOIN public.clientes c   ON c.id_cliente  = co.id_cliente
    LEFT JOIN public.assinaturas a ON a.id_cliente = c.id_cliente
    LEFT JOIN public.planos pl     ON pl.id_plano  = a.id_plano
    LEFT JOIN public.pacote pa     ON pa.id_pacote = a.id_pacote
    WHERE co.telefone IN (${placeholders})
    ORDER BY a.status ASC, a.venc_contas DESC
    LIMIT 10
  `, variants).catch(() => [] as AssinaturaRow[])

  if (assinaturaRows.length === 0) {
    if (profilePicUrl) {
      await query(`UPDATE lab.conversations SET profile_pic_url = $1 WHERE jid = $2`, [profilePicUrl, jid]).catch(() => {})
    }
    return NextResponse.json({ profile_pic_url: profilePicUrl, phone, cliente: null } satisfies ContactInfo)
  }

  const idCliente = assinaturaRows[0].id_cliente

  // 3. Aplicativos
  type AppRow = {
    id_app_registro: number; nome_app: string; chave: string
    mac: string | null; validade: string | null; status: string; observacao: string | null
  }
  const appRows = await query<AppRow>(`
    SELECT ar.id_app_registro, ap.nome_app, ar.chave, ar.mac,
           ar.validade::text, ar.status, ar.observacao
    FROM public.aplicativos ar
    JOIN public.apps ap ON ap.id_app = ar.id_app
    WHERE ar.id_cliente = $1
    ORDER BY ar.status ASC, ar.validade DESC
  `, [idCliente]).catch(() => [] as AppRow[])

  // 4. Indicações (feitas e recebidas)
  type IndicacaoRow = {
    id_indicacao: number; tipo: "fez" | "recebeu"
    id_outro_cliente: number; nome_outro_cliente: string
    telefone_outro_cliente: string | null
    bonificacao: string | null; criado_em: string
  }
  const indicacaoRows = await query<IndicacaoRow>(`
    SELECT i.id_indicacao,
           'fez' AS tipo,
           c2.id_cliente AS id_outro_cliente,
           c2.nome AS nome_outro_cliente,
           co2.telefone AS telefone_outro_cliente,
           i.bonificacao,
           i.criado_em::text
    FROM public.indicacoes i
    JOIN public.clientes c2 ON c2.id_cliente = i.id_indicado
    LEFT JOIN public.contatos co2 ON co2.id_cliente = c2.id_cliente
    WHERE i.id_parceiro = $1

    UNION ALL

    SELECT i.id_indicacao,
           'recebeu' AS tipo,
           c1.id_cliente AS id_outro_cliente,
           c1.nome AS nome_outro_cliente,
           co1.telefone AS telefone_outro_cliente,
           i.bonificacao,
           i.criado_em::text
    FROM public.indicacoes i
    JOIN public.clientes c1 ON c1.id_cliente = i.id_parceiro
    LEFT JOIN public.contatos co1 ON co1.id_cliente = c1.id_cliente
    WHERE i.id_indicado = $1

    ORDER BY criado_em DESC
  `, [idCliente]).catch(() => [] as IndicacaoRow[])

  // Monta JIDs das indicações para links clicáveis
  const indicacoes = indicacaoRows.map(r => ({
    id_indicacao:           r.id_indicacao,
    tipo:                   r.tipo,
    id_outro_cliente:       r.id_outro_cliente,
    nome_outro_cliente:     r.nome_outro_cliente,
    telefone_outro_cliente: r.telefone_outro_cliente,
    jid_outro_cliente:      r.telefone_outro_cliente
      ? r.telefone_outro_cliente.startsWith("55")
        ? `${r.telefone_outro_cliente}@s.whatsapp.net`
        : `55${r.telefone_outro_cliente}@s.whatsapp.net`
      : null,
    bonificacao:            r.bonificacao,
    status_indicacao:       r.bonificacao ?? null,
    criado_em:              r.criado_em,
  }))

  if (profilePicUrl) {
    await query(`UPDATE lab.conversations SET profile_pic_url = $1 WHERE jid = $2`, [profilePicUrl, jid]).catch(() => {})
  }

  const cliente: ContactInfo["cliente"] = {
    id_cliente:       idCliente,
    nome:             assinaturaRows[0].nome,
    score_fidelidade: assinaturaRows[0].score_fidelidade ? Number(assinaturaRows[0].score_fidelidade) : null,
    assinaturas: assinaturaRows.filter(r => r.id_assinatura).map(r => ({
      id_assinatura: r.id_assinatura,
      status:        r.status,
      venc_contas:   r.venc_contas,
      venc_contrato: r.venc_contrato,
      identificacao: r.identificacao,
      plano: r.plano_tipo ? { tipo: r.plano_tipo, telas: r.plano_telas ?? 0, meses: r.plano_meses ?? 0, valor: Number(r.plano_valor ?? 0), descricao: r.plano_descricao } : null,
      pacote: r.pacote_contrato || r.pacote_telas ? { contrato: r.pacote_contrato, telas: r.pacote_telas } : null,
    })),
    aplicativos: appRows,
    indicacoes,
  }

  return NextResponse.json({ profile_pic_url: profilePicUrl, phone, cliente } satisfies ContactInfo)
}
