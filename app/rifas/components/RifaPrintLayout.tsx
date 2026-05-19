"use client"

import type { Rifa, RifaPremio } from "../types"
import { EMOJI_PREMIOS, EMOJI_DEFAULT, formatNumero, formatMoeda, formatData } from "../types"

interface Props {
  rifa: Partial<Rifa>
  organizacao?: Rifa["organizacao"]
  premios?: RifaPremio[]
  somentePagina?: number // undefined = todas as páginas
}

function getBorderCSS(estilo: string): string {
  switch (estilo) {
    case "grossa":     return "3px solid #111"
    case "dupla":      return "4px double #333"
    case "arredondada": return "1px solid #333"
    case "sem":        return "none"
    default:           return "1px solid #333"
  }
}

function getFundoCSS(fundo: string): string {
  switch (fundo) {
    case "cinza-claro": return "#f0f0f0"
    case "cinza-medio": return "#d0d0d0"
    default:            return "#ffffff"
  }
}

export default function RifaPrintLayout({ rifa, organizacao, premios = [], somentePagina }: Props) {
  const {
    titulo = "Título da Rifa",
    detalhes,
    valor_numero = 0,
    data_sorteio,
    local_sorteio,
    numero_inicial = 1,
    quantidade_total = 20,
    numeros_por_pagina = 20,
    colunas_premios = 2,
    fonte = "Arial",
    borda_estilo = "simples",
    zebrado = true,
    emoji_premios = false,
    fundo_cabecalho = "cinza-claro",
    orientacao = "retrato",
    tamanho_papel = "A4",
  } = rifa

  const border = getBorderCSS(borda_estilo)
  const headerBg = getFundoCSS(fundo_cabecalho)
  const borderRadius = borda_estilo === "arredondada" ? 8 : 0
  const fontFamily = fonte === "Montserrat"
    ? "'Montserrat', 'Trebuchet MS', sans-serif"
    : fonte === "Georgia"
    ? "Georgia, serif"
    : "Arial, sans-serif"

  const pageW = orientacao === "paisagem"
    ? (tamanho_papel === "A4" ? "297mm" : "279mm")
    : (tamanho_papel === "A4" ? "210mm" : "216mm")

  // Gera chunks de números por página
  const total = Math.max(numero_inicial, 1)
  const nums = Array.from({ length: quantidade_total }, (_, i) => numero_inicial + i)
  const paginas: number[][] = []
  for (let i = 0; i < nums.length; i += numeros_por_pagina) {
    paginas.push(nums.slice(i, i + numeros_por_pagina))
  }

  const paginasRender = somentePagina !== undefined ? [paginas[somentePagina] ?? []] : paginas
  const showPaginas = paginasRender.filter(Boolean)

  // Distribuição dos prêmios em colunas
  const cols = Math.max(1, Math.min(4, colunas_premios))
  const premiosPorColuna = Math.ceil(premios.length / cols)
  const colunasPremios: RifaPremio[][] = Array.from({ length: cols }, (_, ci) =>
    premios.slice(ci * premiosPorColuna, (ci + 1) * premiosPorColuna)
  )

  const Cabecalho = () => (
    <div style={{
      border,
      borderRadius,
      background: headerBg,
      fontFamily,
      padding: "5px 10px 4px",
      marginBottom: 0,
    }}>
      {/* Organização */}
      <div style={{ textAlign: "center", borderBottom: "1px solid #bbb", paddingBottom: 3, marginBottom: 3 }}>
        {organizacao ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{organizacao.nome}</div>
            {organizacao.subtitulo && <div style={{ fontSize: 9, lineHeight: 1.2 }}>{organizacao.subtitulo}</div>}
            {organizacao.endereco && <div style={{ fontSize: 8.5, lineHeight: 1.2 }}>{organizacao.endereco}</div>}
            {organizacao.cidade && <div style={{ fontSize: 8.5, lineHeight: 1.2 }}>{organizacao.cidade}</div>}
            {organizacao.telefone && <div style={{ fontSize: 8.5, lineHeight: 1.2 }}>{organizacao.telefone}</div>}
          </>
        ) : (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>Organização não selecionada</div>
        )}
      </div>

      {/* Título + valor */}
      <div style={{ textAlign: "center", marginBottom: 3 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.2 }}>{titulo}</div>
        <div style={{
          display: "inline-block",
          border: "1.5px solid #333",
          borderRadius: 4,
          padding: "1px 10px",
          fontSize: 15,
          fontWeight: 700,
          margin: "2px 0",
          lineHeight: 1.3,
        }}>
          {formatMoeda(Number(valor_numero))}
        </div>
        {detalhes && <div style={{ fontSize: 8.5, marginTop: 1, color: "#333", lineHeight: 1.2 }}>{detalhes}</div>}
      </div>

      {/* Prêmios */}
      {premios.length > 0 && (
        <div style={{
          borderTop: "1px solid #bbb",
          borderBottom: "1px solid #bbb",
          padding: "3px 0",
          marginBottom: 3,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: "0 8px",
        }}>
          {colunasPremios.map((col, ci) => (
            <div key={ci}>
              {col.map(p => (
                <div key={p.posicao} style={{
                  fontSize: 8.5,
                  padding: "1px 0",
                  lineHeight: 1.25,
                  fontWeight: p.posicao <= 3 ? 600 : 400,
                }}>
                  {emoji_premios && (
                    <span style={{ marginRight: 3 }}>
                      {EMOJI_PREMIOS[p.posicao] ?? EMOJI_DEFAULT}
                    </span>
                  )}
                  <strong>{p.posicao}°</strong> {p.descricao}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Sorteio */}
      {(data_sorteio || local_sorteio) && (
        <div style={{ textAlign: "center", fontSize: 8.5, fontStyle: "italic", fontWeight: 600, lineHeight: 1.2 }}>
          O Sorteio será realizado{local_sorteio ? ` no ${local_sorteio}` : ""}
          {data_sorteio ? `, dia ${formatData(data_sorteio)}` : ""}
        </div>
      )}
    </div>
  )

  return (
    <div style={{ fontFamily, width: pageW, margin: "0 auto" }}>
      {showPaginas.map((pagNums, pi) => (
        <div
          key={pi}
          className="rifa-page-gap"
          style={{
            pageBreakAfter: pi < showPaginas.length - 1 ? "always" : "auto",
            breakAfter: pi < showPaginas.length - 1 ? "page" : "auto",
            padding: "10mm",
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
            marginBottom: pi < showPaginas.length - 1 ? 28 : 0,
          }}
        >
          <Cabecalho />

          {/* Tabela de bilhetes */}
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily,
            fontSize: 9,
            borderLeft: border,
            borderRight: border,
            borderBottom: border,
          }}>
            <thead>
              <tr style={{ background: "#333", color: "#fff" }}>
                <th style={{ padding: "4px 6px", textAlign: "center", width: 40, border: "1px solid #555", fontWeight: 700 }}>N°</th>
                <th style={{ padding: "4px 6px", textAlign: "left", border: "1px solid #555", fontWeight: 700 }}>Nome</th>
                <th style={{ padding: "4px 6px", textAlign: "center", width: 135, border: "1px solid #555", fontWeight: 700 }}>Telefone</th>
              </tr>
            </thead>
            <tbody>
              {pagNums.map((n, i) => (
                <tr key={n} style={{
                  background: zebrado && i % 2 === 1 ? "#f0f0f0" : "#fff",
                }}>
                  <td style={{ padding: "6px 6px", textAlign: "center", border: "1px solid #ccc", fontWeight: 700, fontSize: 12 }}>
                    {formatNumero(n, numero_inicial + quantidade_total - 1)}
                  </td>
                  <td style={{ padding: "3px 6px", border: "1px solid #ccc" }}></td>
                  <td style={{ padding: "3px 6px", border: "1px solid #ccc" }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
