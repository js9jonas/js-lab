import { query } from "@/lib/db"
import type { Rifa, RifaPremio } from "../types"
import RifaFormPage from "../components/RifaFormPage"

export default async function NovaRifaPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams

  if (from) {
    const [original] = await query<Rifa>(
      `SELECT r.*, row_to_json(o) AS organizacao
       FROM lab.rifas r
       LEFT JOIN lab.rifa_organizacoes o ON o.id = r.organizacao_id
       WHERE r.id = $1`,
      [from]
    )
    if (original) {
      const premios = await query<RifaPremio>(
        `SELECT posicao, descricao FROM lab.rifa_premios WHERE rifa_id = $1 ORDER BY posicao`,
        [from]
      )
      // Remove id para que RifaFormPage trate como nova rifa
      const { id: _, criado_em: __, atualizado_em: ___, ...dados } = original
      return <RifaFormPage rifaInicial={{ ...dados, premios } as never} />
    }
  }

  return <RifaFormPage />
}
