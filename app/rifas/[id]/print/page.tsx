import { query } from "@/lib/db"
import type { Rifa, RifaPremio } from "../../types"
import RifaPrintLayout from "../../components/RifaPrintLayout"
import PrintButton from "../../components/PrintButton"

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [rifa] = await query<Rifa>(
    `SELECT r.*, row_to_json(o) AS organizacao
     FROM lab.rifas r
     LEFT JOIN lab.rifa_organizacoes o ON o.id = r.organizacao_id
     WHERE r.id = $1`,
    [id]
  )

  if (!rifa) return <div style={{ padding: 40 }}>Rifa não encontrada.</div>

  const premios = await query<RifaPremio>(
    `SELECT * FROM lab.rifa_premios WHERE rifa_id = $1 ORDER BY posicao`,
    [id]
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; }
        @media screen {
          body { background: #ccc; padding: 20px; }
          .page-wrapper { background: #fff; margin: 0 auto; box-shadow: 0 2px 16px rgba(0,0,0,0.2); }
        }
        @media print {
          body { background: #fff !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
        @page {
          size: ${rifa.tamanho_papel} ${rifa.orientacao === 'paisagem' ? 'landscape' : 'portrait'};
          margin: 0;
        }
      `}</style>

      {/* Barra de ação (só na tela) */}
      <div className="no-print" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 10,
        background: "#1a1d23", color: "#fff", padding: "10px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          🎟 {rifa.titulo}
          <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 12 }}>
            {rifa.quantidade_total} bilhetes · {Math.ceil(rifa.quantidade_total / rifa.numeros_por_pagina)} páginas
          </span>
        </div>
        <PrintButton />
      </div>

      <div className="page-wrapper" style={{ marginTop: 48 }}>
        <RifaPrintLayout
          rifa={rifa}
          organizacao={rifa.organizacao}
          premios={premios}
        />
      </div>
    </>
  )
}
