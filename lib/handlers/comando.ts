// lib/handlers/comando.ts
// Processa comandos recebidos via WhatsApp (ex: /info, /status, /ajuda)

import type { EvolutionPayload, HandlerResult } from "../types"
import { sendText } from "../evolution"

type CommandHandler = (
  jid: string,
  instance: string,
  args: string[],
  dryRun: boolean
) => Promise<HandlerResult>

// -----------------------------------------------------------------------
// Implementações de cada comando
// -----------------------------------------------------------------------

const cmdInfo: CommandHandler = async (jid, instance, _args, dryRun) => {
  // TODO: buscar cliente no PostgreSQL pelo jid (já existe no js-painel)
  const msg = `📋 *Seus dados*\n\nAinda não integrado com o banco.\nEm desenvolvimento. 🔧`
  if (!dryRun) await sendText(instance, jid, msg)
  return { success: true, action: "cmd_info", detail: "stub" }
}

const cmdStatus: CommandHandler = async (jid, instance, _args, dryRun) => {
  const msg = `🟢 *JS Lab online*\n\nWebhook ativo | Evolution API conectada`
  if (!dryRun) await sendText(instance, jid, msg)
  return { success: true, action: "cmd_status" }
}

const cmdAjuda: CommandHandler = async (jid, instance, _args, dryRun) => {
  const msg = [
    "📌 *Comandos disponíveis:*",
    "",
    "/info — seus dados de assinatura",
    "/status — status do sistema",
    "/ajuda — esta mensagem",
  ].join("\n")
  if (!dryRun) await sendText(instance, jid, msg)
  return { success: true, action: "cmd_ajuda" }
}

// Mapa de comandos registrados
const COMMANDS: Record<string, CommandHandler> = {
  "/info": cmdInfo,
  "/status": cmdStatus,
  "/ajuda": cmdAjuda,
  "/help": cmdAjuda,
}

// -----------------------------------------------------------------------
// Entry point do handler
// -----------------------------------------------------------------------

export async function handleComando(
  payload: EvolutionPayload,
  dryRun = false
): Promise<HandlerResult> {
  const jid = payload.data.key.remoteJid
  const instance = payload.instance
  const text = (payload.data.message?.conversation as string ?? "").trim()
  const parts = text.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  const handler = COMMANDS[cmd]
  if (!handler) {
    if (!dryRun) {
      await sendText(instance, jid, `Comando *${cmd}* não reconhecido. Digite /ajuda para ver os disponíveis.`)
    }
    return { success: false, action: "cmd_desconhecido", detail: cmd }
  }

  return handler(jid, instance, args, dryRun)
}
