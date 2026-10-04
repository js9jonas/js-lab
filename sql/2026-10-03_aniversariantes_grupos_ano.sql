-- Aniversariantes além do MEMBRO CRUZEIRO (CLIENTE, FAMÍLIA, AMIGOS) — 03/10/2026.
-- ano_desconhecido: Facebook e muita gente informam só dia e mês. Nesse caso data_nasc guarda o
-- ano 2000 (bissexto, aceita 29/02) só como marcador; idade não é calculada nem mostrada.
-- A sincronização com o js-comunidade (lib/aniversariantesSync.ts) continua tocando só o grupo
-- MEMBRO CRUZEIRO.
ALTER TABLE lab.aniversariantes ADD COLUMN IF NOT EXISTS ano_desconhecido boolean NOT NULL DEFAULT false;
