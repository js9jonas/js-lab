// lib/db.ts
// Conexão com PostgreSQL e funções de acesso ao banco
// Usa o mesmo banco do js-painel (schema "js")

import { Pool } from "pg"
import type { WebhookLog } from "./types"

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const res = await client.query(sql, params)
    return res.rows as T[]
  } finally {
    client.release()
  }
}

// -----------------------------------------------------------------------
// Migrations — roda uma vez para criar a tabela de log
// -----------------------------------------------------------------------

export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS lab.webhook_logs (
      id             SERIAL PRIMARY KEY,
      received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      instance       TEXT NOT NULL,
      from_jid       TEXT NOT NULL,
      message_type   TEXT NOT NULL,
      kind           TEXT NOT NULL,
      confidence     TEXT NOT NULL,
      handler_action TEXT NOT NULL,
      success        BOOLEAN NOT NULL,
      detail         TEXT,
      raw_payload    JSONB
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_wh_received ON lab.webhook_logs (received_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_wh_kind ON lab.webhook_logs (kind)`)
  await query(`ALTER TABLE public.contatos ADD COLUMN IF NOT EXISTS labels_sync_em TIMESTAMPTZ`)
  console.log("[db] migrations ok")
}

// -----------------------------------------------------------------------
// Log de webhook
// -----------------------------------------------------------------------

export async function logWebhook(log: Omit<WebhookLog, "id">) {
  await query(
    `INSERT INTO lab.webhook_logs
      (received_at, instance, from_jid, message_type, kind, confidence,
       handler_action, success, detail, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      log.received_at,
      log.instance,
      log.from_jid,
      log.message_type,
      log.kind,
      log.confidence,
      log.handler_action,
      log.success,
      log.detail ?? null,
      JSON.stringify(log.raw_payload),
    ]
  )
}

// -----------------------------------------------------------------------
// Leitura de logs para a interface
// -----------------------------------------------------------------------

export async function getRecentLogs(limit = 50): Promise<WebhookLog[]> {
  return query<WebhookLog>(
    `SELECT id, received_at, instance, from_jid, message_type, kind,
            confidence, handler_action, success, detail
     FROM lab.webhook_logs
     ORDER BY received_at DESC
     LIMIT $1`,
    [limit]
  )
}
