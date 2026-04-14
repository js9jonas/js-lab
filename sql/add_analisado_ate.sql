-- Adiciona coluna analisado_ate na tabela lab.agentes
-- Registra quando foi feita a última análise multi-conversa do agente
-- Rodar via:
--   docker exec -i <container_postgres> psql -U postgres -d js < sql/add_analisado_ate.sql

ALTER TABLE lab.agentes
  ADD COLUMN IF NOT EXISTS analisado_ate TIMESTAMPTZ;
