import { query } from "./db"
import { findLabels, handleLabel, WaLabel } from "./evolution"

const MANAGED_PANELS = ["club", "central", "uniplay", "fast", "unitv", "now"] as const
type PanelType = (typeof MANAGED_PANELS)[number]

// Cache das etiquetas WA — evita chamar findLabels a cada sync
let labelsCache: WaLabel[] | null = null
let labelsCacheAt = 0
const LABELS_CACHE_TTL = 3_600_000 // 1 hora

async function getLabels(instance: string): Promise<WaLabel[]> {
  if (labelsCache && Date.now() - labelsCacheAt < LABELS_CACHE_TTL) return labelsCache
  labelsCache = await findLabels(instance)
  labelsCacheAt = Date.now()
  return labelsCache
}

function panelMatchesLabel(panelTipo: PanelType, labelName: string): boolean {
  const name = labelName.toLowerCase()
  // "unit" e "unitv" são aceitos para o painel_tipo unitv
  if (panelTipo === "unitv") return name === "unit" || name === "unitv"
  return name === panelTipo
}

/**
 * Extrai possíveis formatos de telefone a partir de um JID.
 * JID: 555180425096@s.whatsapp.net → ["5180425096", ...]
 * Lida com o dígito 9 adicionado ao celular BR após 2012.
 */
function jidToPhones(jid: string): string[] {
  const number = jid.split("@")[0]
  // Normaliza número com device suffix (ex: 5511999:12@s.whatsapp.net)
  const clean = number.includes(":") ? number.split(":")[0] : number

  if (!clean.startsWith("55")) return [clean]

  const withoutCountry = clean.slice(2) // DDD + número local

  if (withoutCountry.length === 11) {
    // Celular com 9º dígito: 51 9 99999999 → tenta também sem o 9
    const withoutNinth = withoutCountry.slice(0, 2) + withoutCountry.slice(3)
    return [withoutCountry, withoutNinth]
  }

  return [withoutCountry]
}

/**
 * Sincroniza as etiquetas gerenciadas de um chat com as assinaturas ativas do cliente.
 * Dispara no máximo uma vez por dia por contato.
 */
export async function maybeSyncLabels(jid: string, instance: string): Promise<void> {
  if (!jid || jid.endsWith("@g.us") || jid.endsWith("@lid")) return

  const phones = jidToPhones(jid)

  const contacts = await query<{ id_cliente: string; labels_sync_em: Date | null; telefone: string }>(
    `SELECT id_cliente, labels_sync_em, telefone
     FROM public.contatos
     WHERE telefone = ANY($1)
     LIMIT 1`,
    [phones]
  )

  if (!contacts.length) return

  const { id_cliente, labels_sync_em, telefone } = contacts[0]

  // Já sincronizado hoje → pula
  if (labels_sync_em) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(labels_sync_em) >= today) return
  }

  // Servidores ativos do cliente
  const rows = await query<{ painel_tipo: PanelType }>(
    `SELECT DISTINCT s.painel_tipo
     FROM public.assinaturas a
     JOIN public.consumo_servidor cs ON cs.id_pacote = a.id_pacote
     JOIN public.servidores s ON s.id_servidor = cs.id_servidor
     WHERE a.id_cliente = $1
       AND a.status IN ('ativo', 'atrasado', 'pendente', 'vencido')
       AND s.painel_tipo IN ('club', 'central', 'uniplay', 'fast', 'unitv', 'now')`,
    [id_cliente]
  )

  const activePanels = new Set(rows.map((r) => r.painel_tipo))
  const allLabels = await getLabels(instance)

  for (const panel of MANAGED_PANELS) {
    const label = allLabels.find((l) => panelMatchesLabel(panel, l.name))
    if (!label) {
      console.warn(`[label-sync] etiqueta não encontrada para painel '${panel}'`)
      continue
    }

    const action = activePanels.has(panel) ? "add" : "remove"
    await handleLabel(instance, telefone, label.id, action).catch((err: Error) =>
      console.error(`[label-sync] ${action} '${label.name}' → ${telefone}: ${err.message}`)
    )
  }

  await query(
    `UPDATE public.contatos SET labels_sync_em = NOW() WHERE telefone = ANY($1)`,
    [phones]
  )

  console.log(`[label-sync] sincronizado ${jid} → painéis: [${[...activePanels].join(", ")}]`)
}
