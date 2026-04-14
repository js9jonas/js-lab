// app/api/chat/contact-name/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const dynamic = "force-dynamic"

function phoneVariants(jid: string): string[] {
  const num = jid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "")
  const variants = new Set([num])
  // com/sem código de país 55
  if (num.startsWith("55") && num.length >= 12) variants.add(num.slice(2))
  if (!num.startsWith("55") && num.length <= 11) variants.add("55" + num)
  // variante sem nono dígito: 55 + DDD(2) + 9 + 8 dígitos → 55 + DDD + 8 dígitos
  if (num.startsWith("55") && num.length === 13 && num[4] === "9") {
    variants.add(num.slice(0, 4) + num.slice(5))   // remove o 9 após o DDD
    variants.add(num.slice(2, 4) + num.slice(5))   // sem 55, sem nono dígito
  }
  return [...variants]
}

export async function GET(req: NextRequest) {
  const jid = new URL(req.url).searchParams.get("jid")
  if (!jid) return NextResponse.json({ name: null })

  const variants = phoneVariants(jid)
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(", ")

  type Row = { name: string }
  const rows = await query<Row>(`
    SELECT COALESCE(cl.nome, co.nome) AS name
    FROM public.contatos co
    LEFT JOIN public.clientes cl ON cl.id_cliente = co.id_cliente
    WHERE regexp_replace(co.telefone, '[^0-9]', '', 'g') IN (${placeholders})
    LIMIT 1
  `, variants).catch(() => [] as Row[])

  return NextResponse.json({ name: rows[0]?.name ?? null })
}
