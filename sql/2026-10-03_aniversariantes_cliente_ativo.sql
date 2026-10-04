-- Quem é CLIENTE entre os aniversariantes (03/10/2026, regra do Jonas): o telefone tem assinatura com
-- status 'ativo' no js-painel (public.contatos → public.assinaturas). Senão é AMIGO - FAMÍLIA.
-- Usado pela importação do /aniversariantes e pelo n8n na hora de montar a mensagem do dia.
--
-- Comparação por DDD + últimos 8 dígitos: public.contatos guarda muitos números antigos sem o 9º dígito
-- (55 + DDD + 8), e lab.aniversariantes guarda com o 9 (55 + DDD + 9). Só números brasileiros (55…).

CREATE OR REPLACE FUNCTION lab.chave_telefone(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN d ~ '^55[0-9]{10,11}$' THEN substr(d, 3, 2) || right(d, 8) END
  FROM (SELECT regexp_replace(coalesce(t, ''), '\D', '', 'g') AS d) x
$$;

CREATE OR REPLACE FUNCTION lab.telefone_cliente_ativo(t text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT lab.chave_telefone(t) IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.contatos ct
    JOIN public.assinaturas a ON a.id_cliente = ct.id_cliente
    WHERE a.status = 'ativo'
      AND lab.chave_telefone(ct.telefone) = lab.chave_telefone(t)
  )
$$;
