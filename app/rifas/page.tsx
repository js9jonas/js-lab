"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { Rifa } from "./types"
import { formatMoeda, formatData } from "./types"

interface RifaComExtras extends Rifa {
  org_nome?: string
  total_premios?: number
}

export default function RifasPage() {
  const [rifas, setRifas] = useState<RifaComExtras[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const data = await fetch("/api/rifas").then(r => r.json())
    setRifas(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: number) {
    if (!confirm("Excluir esta rifa?")) return
    await fetch(`/api/rifas/${id}`, { method: "DELETE" })
    load()
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Rifas</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Gerador de rifas para impressão</div>
        </div>
        <Link href="/rifas/nova" style={{
          padding: "8px 16px", borderRadius: 8, background: "var(--blue)", color: "#fff",
          textDecoration: "none", fontSize: 13, fontWeight: 600,
        }}>
          + Nova Rifa
        </Link>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 40, textAlign: "center" }}>Carregando...</div>
      ) : rifas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎟</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma rifa cadastrada</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Crie uma nova rifa para começar</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rifas.map(r => (
            <div key={r.id} style={{
              background: "var(--bg-surface)", borderRadius: 10, border: "1px solid var(--border)",
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ fontSize: 24 }}>🎟</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{r.titulo}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {r.org_nome && <span>{r.org_nome} · </span>}
                  {r.total_premios} prêmios · {r.quantidade_total} números · {formatMoeda(Number(r.valor_numero))}/número
                  {r.data_sorteio && <span> · Sorteio: {formatData(r.data_sorteio)}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <a
                  href={`/rifas/${r.id}/print`}
                  target="_blank"
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, textDecoration: "none", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                >
                  🖨 Imprimir
                </a>
                <Link
                  href={`/rifas/${r.id}`}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, textDecoration: "none", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                >
                  Editar
                </Link>
                <Link
                  href={`/rifas/nova?from=${r.id}`}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, textDecoration: "none", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
                >
                  Duplicar
                </Link>
                <button
                  onClick={() => handleDelete(r.id)}
                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #fca5a5", fontSize: 12, background: "#fff1f1", color: "var(--red)", cursor: "pointer" }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
