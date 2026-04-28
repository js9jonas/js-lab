// lib/handlers/comando.ts
// Processa comandos recebidos via WhatsApp (ex: /info, /status, /ajuda)
// As respostas são armazenadas em lab.comandos e editáveis pela UI.

import type { EvolutionPayload, HandlerResult } from "../types"
import { sendText } from "../evolution"
import { query } from "../db"

export async function handleComando(
  payload: EvolutionPayload,
  dryRun = false
): Promise<HandlerResult> {
  const jid      = payload.data.key.remoteJid
  const instance = payload.instance
  const text     = (payload.data.message?.conversation as string ?? "").trim()
  const trigger  = text.split(/\s+/)[0].toLowerCase()

  try {
    // /ajuda e /help constroem a lista dinamicamente a partir do banco
    if (trigger === "/ajuda" || trigger === "/help") {
      const cmds = await query<{ trigger: string; descricao: string }>(
        `SELECT trigger, descricao FROM lab.comandos WHERE ativo = true ORDER BY trigger`
      )
      const msg = ["📌 *Comandos disponíveis:*", ""]
        .concat(cmds.map(c => `${c.trigger} — ${c.descricao}`))
        .join("\n")
      if (!dryRun) await sendText(instance, jid, msg)
      return { success: true, action: "cmd_ajuda" }
    }

    const rows = await query<{ resposta: string }>(
      `SELECT resposta FROM lab.comandos WHERE trigger = $1 AND ativo = true`,
      [trigger]
    )

    if (rows.length === 0) {
      if (!dryRun) {
        await sendText(instance, jid, `Comando *${trigger}* não reconhecido. Digite /ajuda para ver os disponíveis.`)
      }
      return { success: false, action: "cmd_desconhecido", detail: trigger }
    }

    if (!dryRun) await sendText(instance, jid, rows[0].resposta)
    return { success: true, action: `cmd_${trigger.replace(/^[\/!#]/, "")}` }
  } catch (err) {
    console.error("[handleComando] erro ao consultar DB:", err)
    if (!dryRun) {
      await sendText(instance, jid, "⚠️ Erro interno ao processar o comando.")
    }
    return { success: false, action: "cmd_erro", detail: String(err) }
  }
}
