-- ============================================================
-- Módulo de Rifas — JS Lab
-- Schema: lab | Banco: js
-- ============================================================

-- Organizações (multi-tenant)
CREATE TABLE IF NOT EXISTS lab.rifa_organizacoes (
  id           SERIAL PRIMARY KEY,
  nome         VARCHAR NOT NULL,
  subtitulo    VARCHAR,
  endereco     VARCHAR,
  cidade       VARCHAR,
  telefone     VARCHAR,
  logo_url     TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organização padrão (exemplo IECLB)
INSERT INTO lab.rifa_organizacoes (nome, subtitulo, endereco, cidade, telefone)
VALUES (
  'Comunidade Evangélica de Confissão Luterana de Cruzeiro do Sul - IECLB',
  'OASE de Cruzeiro do Sul',
  'Rua Visconde de Rio Branco, 151 - Centro',
  'Cruzeiro do Sul - RS · Cp 93530-000',
  'Fone 784-1268'
) ON CONFLICT DO NOTHING;

-- Rifas
CREATE TABLE IF NOT EXISTS lab.rifas (
  id                  SERIAL PRIMARY KEY,
  organizacao_id      INTEGER REFERENCES lab.rifa_organizacoes(id),
  titulo              VARCHAR NOT NULL,
  detalhes            TEXT,
  valor_numero        NUMERIC(10,2) NOT NULL DEFAULT 3.00,
  data_sorteio        DATE,
  local_sorteio       VARCHAR,
  numero_inicial      INTEGER NOT NULL DEFAULT 1,
  quantidade_total    INTEGER NOT NULL DEFAULT 100,
  numeros_por_pagina  INTEGER NOT NULL DEFAULT 20,
  colunas_premios     INTEGER NOT NULL DEFAULT 2,
  -- Visual
  tema                VARCHAR NOT NULL DEFAULT 'classico',
  fonte               VARCHAR NOT NULL DEFAULT 'Arial',
  borda_estilo        VARCHAR NOT NULL DEFAULT 'simples',
  zebrado             BOOLEAN NOT NULL DEFAULT TRUE,
  emoji_premios       BOOLEAN NOT NULL DEFAULT FALSE,
  fundo_cabecalho     VARCHAR NOT NULL DEFAULT 'cinza-claro',
  orientacao          VARCHAR NOT NULL DEFAULT 'retrato',
  tamanho_papel       VARCHAR NOT NULL DEFAULT 'A4',
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prêmios
CREATE TABLE IF NOT EXISTS lab.rifa_premios (
  id          SERIAL PRIMARY KEY,
  rifa_id     INTEGER NOT NULL REFERENCES lab.rifas(id) ON DELETE CASCADE,
  posicao     INTEGER NOT NULL,
  descricao   VARCHAR NOT NULL,
  UNIQUE(rifa_id, posicao)
);

-- Bilhetes (v2 — registrar vendas)
CREATE TABLE IF NOT EXISTS lab.rifa_bilhetes (
  id          SERIAL PRIMARY KEY,
  rifa_id     INTEGER NOT NULL REFERENCES lab.rifas(id) ON DELETE CASCADE,
  numero      INTEGER NOT NULL,
  nome        VARCHAR,
  telefone    VARCHAR,
  valor_pago  NUMERIC(10,2),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rifa_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_rifa_premios_rifa ON lab.rifa_premios(rifa_id);
CREATE INDEX IF NOT EXISTS idx_rifa_bilhetes_rifa ON lab.rifa_bilhetes(rifa_id);

-- Verificação
SELECT tablename FROM pg_tables WHERE schemaname = 'lab' AND tablename LIKE 'rifa%' ORDER BY tablename;
