-- ============================================================
-- JS Laboratório — Migration inicial
-- Schema: lab (já criado manualmente)
-- Banco: js (mesmo do js-painel e js-financeiro)
-- ============================================================
-- Rodar via:
--   docker exec -i <container_postgres> psql -U postgres -d js < migration.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. Log de webhooks recebidos da Evolution API
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab.webhook_logs (
  id             SERIAL PRIMARY KEY,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instance       TEXT NOT NULL,           -- ex: jsevolution
  from_jid       TEXT NOT NULL,           -- ex: 5551999887766@s.whatsapp.net
  message_type   TEXT NOT NULL,           -- ex: imageMessage, conversation
  kind           TEXT NOT NULL,           -- classificação: comprovante_pix, comando...
  confidence     TEXT NOT NULL,           -- alta, media, baixa
  handler_action TEXT NOT NULL,           -- o que o handler fez
  success        BOOLEAN NOT NULL,
  detail         TEXT,                    -- info extra ou mensagem de erro
  raw_payload    JSONB                    -- payload completo para debug
);

CREATE INDEX IF NOT EXISTS idx_wh_received
  ON lab.webhook_logs (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_wh_kind
  ON lab.webhook_logs (kind);

CREATE INDEX IF NOT EXISTS idx_wh_from_jid
  ON lab.webhook_logs (from_jid);


-- ------------------------------------------------------------
-- 2. Configuração de handlers (para ligar/desligar pela interface)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab.handler_config (
  kind        TEXT PRIMARY KEY,           -- comprovante_pix, comando, audio...
  enabled     BOOLEAN NOT NULL DEFAULT true,
  min_confidence TEXT NOT NULL DEFAULT 'media', -- ignorar classificações abaixo disso
  meta        JSONB,                      -- configurações extras por handler
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Popula com os handlers existentes
INSERT INTO lab.handler_config (kind, enabled, min_confidence) VALUES
  ('comprovante_pix', true,  'media'),
  ('comando',         true,  'alta'),
  ('audio',           false, 'alta'),
  ('texto_livre',     false, 'alta'),
  ('ignorar',         true,  'alta')
ON CONFLICT (kind) DO NOTHING;


-- ------------------------------------------------------------
-- Verificação final
-- ------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamanho
FROM pg_tables
WHERE schemaname = 'lab'
ORDER BY tablename;
