"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const DIAS_S = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

type Evento = {
  id: number; titulo: string; hora: string | null; hora_fim: string | null
  local: string | null; categoria_nome: string | null
  categoria_cor: string | null; categoria_icone: string | null
}

const CAT_CLASSES: Record<string, { bg: string; text: string; dot: string }> = {
  "Culto":                { bg:"#eff6ff", text:"#1e40af", dot:"#3b82f6" },
  "Reunião":              { bg:"#f0f9ff", text:"#075985", dot:"#0284c7" },
  "Conversa Batismal":    { bg:"#eef2ff", text:"#3730a3", dot:"#6366f1" },
  "Grupo de Louvor":      { bg:"#ecfeff", text:"#155e75", dot:"#06b6d4" },
  "Ensino Confirmatório": { bg:"#f0fdf4", text:"#14532d", dot:"#22c55e" },
  "Plantão Pastoral":     { bg:"#faf5ff", text:"#6b21a8", dot:"#a855f7" },
  "Feriado":              { bg:"#fff1f2", text:"#9f1239", dot:"#f43f5e" },
  "Informativo":          { bg:"#f8fafc", text:"#334155", dot:"#64748b" },
  "Evento Especial":      { bg:"#fffbeb", text:"#92400e", dot:"#f59e0b" },
  "OASE":                 { bg:"#fdf2f8", text:"#9d174d", dot:"#ec4899" },
  "Festa / Kerb":         { bg:"#fff7ed", text:"#9a3412", dot:"#f97316" },
  "Ação de Graças":       { bg:"#f0fdf4", text:"#14532d", dot:"#16a34a" },
  "Férias / Folga":       { bg:"#f1f5f9", text:"#475569", dot:"#94a3b8" },
}

function getStyle(nome: string | null) {
  return CAT_CLASSES[nome ?? ""] ?? { bg:"#f8fafc", text:"#334155", dot:"#64748b" }
}

function getDaysInMonth(ano: number, mes: number) {
  return new Date(ano, mes + 1, 0).getDate()
}

function PageContent() {
  const params = useSearchParams()
  const now = new Date()
  const [ano, setAno] = useState(Number(params.get("ano") ?? now.getFullYear()))
  const [mes, setMes] = useState(Number(params.get("mes") ?? now.getMonth() + 1) - 1)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [lema, setLema] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [evRes, lmRes] = await Promise.all([
        fetch(`/api/agenda?mes=${mes + 1}&ano=${ano}`),
        fetch(`/api/agenda/lemas?ano=${ano}`)
      ])
      const evs: Evento[] = await evRes.json()
      const lmas: { mes: number; lema: string }[] = await lmRes.json()
      setEventos(evs)
      setLema(lmas.find(l => l.mes === mes + 1)?.lema ?? "")
      setLoading(false)
    }
    load()
  }, [ano, mes])

  function prevMes() { if (mes === 0) { setMes(11); setAno(a => a - 1) } else setMes(m => m - 1) }
  function nextMes() { if (mes === 11) { setMes(0); setAno(a => a + 1) } else setMes(m => m + 1) }

  const primeiroDia = new Date(ano, mes, 1).getDay()
  const totalDias = getDaysInMonth(ano, mes)
  const totalCelulas = Math.ceil((primeiroDia + totalDias) / 7) * 7

  const byDay: Record<number, Evento[]> = {}
  eventos.forEach(ev => {
    const dayNum = new Date((ev as any).data.split("T")[0] + "T12:00:00").getDate()
    if (!byDay[dayNum]) byDay[dayNum] = []
    byDay[dayNum].push(ev)
  })

  const lemaTexto = lema.replace(/\(([^)]+)\)$/, "").trim()
  const lemaRef   = lema.match(/\(([^)]+)\)$/)?.[0] ?? ""

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Outfit', -apple-system, sans-serif;
          background: #eef0f4;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          padding: 20px;
          background: #eef0f4;
        }

        #calendario {
          width: 1100px;
          margin: 0 auto 40px;
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: white !important;
          }
          .toolbar {
            display: none !important;
          }
          #calendario {
            width: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          @page {
            size: A3 landscape;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="toolbar">
        <button onClick={prevMes} style={navBtn}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", minWidth: 160, textAlign: "center" }}>
          {MESES[mes]} {ano}
        </span>
        <button onClick={nextMes} style={navBtn}>›</button>
        <div style={{ width: 1, height: 24, background: "#d1d5db" }} />
        <button onClick={() => window.print()} disabled={loading} style={btnDark}>
          ⎙ Imprimir / Salvar PDF
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>
          Carregando...
        </div>
      ) : (
        <div id="calendario">

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg,#0d1b33 0%,#1a2f57 45%,#0f2240 100%)",
            padding: "34px 42px 28px", position: "relative", overflow: "hidden",
            display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24
          }}>
            <div style={{
              position: "absolute", right: -16, top: -8,
              fontSize: 118, fontWeight: 800,
              color: "rgba(255,255,255,0.04)", letterSpacing: -3,
              lineHeight: 1, whiteSpace: "nowrap", pointerEvents: "none", userSelect: "none"
            }}>
              {MESES[mes].toUpperCase()}
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 46, fontWeight: 800, color: "#fff", letterSpacing: -1.5, lineHeight: 1, marginBottom: 3 }}>
                {MESES[mes]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 300, color: "rgba(255,255,255,.45)", letterSpacing: 5 }}>
                {ano}
              </div>
              <div style={{ width: 36, height: 3, background: "#e6a817", borderRadius: 2, margin: "13px 0 11px" }} />
              {lema && (
                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)", maxWidth: 500, lineHeight: 1.6, fontWeight: 300, fontStyle: "italic" }}>
                  {lemaTexto}{" "}
                  <span style={{ color: "#e6a817", fontWeight: 600, fontStyle: "normal" }}>{lemaRef}</span>
                </div>
              )}
            </div>

            <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.4)", letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1.6 }}>
                Paróquia Martin Luther<br />Cruzeiro do Sul – RS
              </div>
            </div>
          </div>

          {/* Dias da semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#f7f9fc", borderBottom: "1px solid #e8eaed" }}>
            {DIAS_S.map((d, i) => (
              <div key={d} style={{
                padding: "9px 12px", textAlign: "center",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#94a3b8"
              }}>{d}</div>
            ))}
          </div>

          {/* Grid dias */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {Array.from({ length: totalCelulas }).map((_, idx) => {
              const dayNum = idx - primeiroDia + 1
              const valid  = dayNum >= 1 && dayNum <= totalDias
              const dow    = idx % 7
              const isWk   = dow === 0 || dow === 6
              const evsDia = valid ? (byDay[dayNum] || []) : []

              return (
                <div key={idx} style={{
                  background: !valid ? "#fbfbfc" : isWk ? "#f9fafb" : "#fff",
                  borderRight: "1px solid #e8eaed",
                  borderTop: "1px solid #e8eaed",
                  padding: "10px 9px 8px",
                  minHeight: 120,
                  display: "flex", flexDirection: "column",
                  opacity: !valid ? 0.2 : 1
                }}>
                  {valid && (
                    <>
                      <div style={{ fontSize: 20, fontWeight: 700, color: isWk ? "#64748b" : "#0f172a", lineHeight: 1, marginBottom: 7 }}>
                        {dayNum}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                        {evsDia.map(ev => {
                          const st = getStyle(ev.categoria_nome)
                          return (
                            <div key={ev.id} style={{
                              display: "flex", alignItems: "flex-start", gap: 4,
                              padding: "3px 6px 3px 4px", borderRadius: 5,
                              background: st.bg, overflow: "hidden"
                            }}>
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: st.dot, flexShrink: 0, marginTop: 4 }} />
                              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                {ev.hora && (
                                  <span style={{ fontSize: 8.5, fontWeight: 700, color: st.text, opacity: .75, lineHeight: 1.3 }}>
                                    {ev.hora}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, fontWeight: 500, color: st.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                                  {ev.titulo}
                                </span>
                                {ev.local && (
                                  <span style={{ fontSize: 8.5, color: st.text, opacity: .65, lineHeight: 1.2 }}>
                                    {ev.local}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div style={{ background: "#f7f9fc", borderTop: "1px solid #e8eaed", padding: "12px 42px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {Object.entries(CAT_CLASSES).map(([nome, st]) => (
                <div key={nome} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#475569", fontWeight: 500 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: st.dot, flexShrink: 0 }} />
                  {nome}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>
              Gerado via JS Lab · Paróquia Martin Luther
            </div>
          </div>

        </div>
      )}
    </>
  )
}

export default function AgendaExportarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Carregando...</div>}>
      <PageContent />
    </Suspense>
  )
}

const navBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #d1d5db", borderRadius: 8,
  padding: "6px 12px", cursor: "pointer", fontSize: 18, color: "#475569",
  fontFamily: "inherit", lineHeight: 1
}
const btnDark: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 10, border: "none",
  background: "#0f172a", color: "#fff",
  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
  cursor: "pointer"
}