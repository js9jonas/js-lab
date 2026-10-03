-- Sincronização de lab.aniversariantes (grupo MEMBRO CRUZEIRO) com o cadastro de membros do js-comunidade.
-- ref_comunidade: chave da pessoa no cadastro ('m<id>' membro, 'd<id>' dependente), preenchida pela
-- sincronização. Depois da primeira vez, o vínculo não depende mais de comparar nomes.
-- aniversariantes_removidos: quem a sincronização tira da lista, com o motivo (nada se perde).
BEGIN;

ALTER TABLE lab.aniversariantes ADD COLUMN ref_comunidade text;
CREATE UNIQUE INDEX aniversariantes_ref_comunidade_uk ON lab.aniversariantes (ref_comunidade) WHERE ref_comunidade IS NOT NULL;

CREATE TABLE lab.aniversariantes_removidos (
  id            serial PRIMARY KEY,
  id_original   integer NOT NULL,
  nome          text NOT NULL,
  telefone      text,
  data_nasc     date,
  grupo         text,
  observacao    text,
  ref_comunidade text,
  motivo        text NOT NULL,
  removido_em   timestamptz NOT NULL DEFAULT now()
);

COMMIT;
