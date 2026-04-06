// ──────────────────────────────────────────────────────────────
// Componente <LemasModal> — adicionar ao app/agenda/page.tsx
// ──────────────────────────────────────────────────────────────
//
// 1. Adicionar imports no topo do page.tsx:
//    import { useRouter } from "next/navigation"   (já deve estar ou não usado)
//
// 2. Adicionar ao array de tipos (junto com Evento, Categoria):
//    type Lema = { id?: number; mes: number; lema: string }
//
// 3. Adicionar ao estado da AgendaPage:
//    const [lemasOpen, setLemasOpen] = useState(false)
//    const [lemas, setLemas]         = useState<Lema[]>([])
//    const [lemaAno, setLemaAno]     = useState(new Date().getFullYear())
//
// 4. Adicionar função de carga de lemas:
//    async function carregarLemas(a = lemaAno) {
//      const r = await fetch(`/api/agenda/lemas?ano=${a}`)
//      setLemas(await r.json())
//    }
//    useEffect(() => { if (lemasOpen) carregarLemas() }, [lemasOpen, lemaAno])
//
// 5. No JSX do toolbar, adicionar dois botões após o toggle de view:
//
//    <button onClick={() => setLemasOpen(true)} style={btnLemas}>
//      ✦ Lemas
//    </button>
//
//    <button
//      onClick={() => window.open(`/agenda/exportar?mes=${mes+1}&ano=${ano}`, '_blank')}
//      style={btnExport}>
//      ⬇ Exportar
//    </button>
//
// 6. Adicionar o componente antes do </> final:
//    <LemasModal
//      open={lemasOpen}
//      onClose={() => setLemasOpen(false)}
//      lemas={lemas}
//      ano={lemaAno}
//      onAnoChange={a => { setLemaAno(a); carregarLemas(a) }}
//      onSaved={() => carregarLemas()}
//    />
//
// 7. Adicionar estilos inline no arquivo:
//    const btnLemas: React.CSSProperties = {
//      display:"flex", alignItems:"center", gap:5,
//      padding:"7px 13px", borderRadius:8, border:"1px solid #e6a81740",
//      background:"#fffbeb", color:"#92400e",
//      fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit"
//    }
//    const btnExport: React.CSSProperties = {
//      display:"flex", alignItems:"center", gap:5,
//      padding:"7px 13px", borderRadius:8, border:"1px solid var(--border)",
//      background:"var(--bg-active)", color:"var(--text-secondary)",
//      fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit"
//    }
//
// ──────────────────────────────────────────────────────────────

"use client"
import { useState } from "react"

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

type Lema = { id?: number; mes: number; lema: string }

export function LemasModal({
  open, onClose, lemas, ano, onAnoChange, onSaved
}: {
  open: boolean
  onClose: () => void
  lemas: Lema[]
  ano: number
  onAnoChange: (ano: number) => void
  onSaved: () => void
}) {
  const [editingMes, setEditingMes] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [saving, setSaving] = useState(false)

  if (!open) return null

  // Montar lista completa dos 12 meses
  const mesMap: Record<number, Lema> = {}
  lemas.forEach(l => { mesMap[l.mes] = l })

  function startEdit(mes: number) {
    setEditingMes(mes)
    setEditText(mesMap[mes]?.lema ?? "")
  }

  function cancelEdit() {
    setEditingMes(null)
    setEditText("")
  }

  async function saveEdit(mes: number) {
    setSaving(true)
    const existing = mesMap[mes]
    if (existing?.id) {
      if (editText.trim() === "") {
        await fetch(`/api/agenda/lemas/${existing.id}`, { method: "DELETE" })
      } else {
        await fetch(`/api/agenda/lemas/${existing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lema: editText.trim() })
        })
      }
    } else if (editText.trim()) {
      await fetch("/api/agenda/lemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano, mes, lema: editText.trim() })
      })
    }
    setSaving(false)
    setEditingMes(null)
    setEditText("")
    onSaved()
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
      zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"var(--bg-surface)", border:"1px solid var(--border)",
        borderRadius:16, width:"100%", maxWidth:660,
        maxHeight:"88vh", display:"flex", flexDirection:"column",
        overflow:"hidden"
      }}>

        {/* Header do modal */}
        <div style={{ padding:"20px 24px 16px",
          borderBottom:"1px solid var(--border)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          flexShrink:0 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--text-primary)",
              letterSpacing:"-0.02em" }}>
              ✦ Lemas Mensais
            </div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
              Versículos / temas de cada mês do ano
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Seletor de ano */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={() => onAnoChange(ano - 1)} style={yrBtn}>‹</button>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)",
                fontFamily:"var(--mono)", minWidth:40, textAlign:"center" }}>
                {ano}
              </span>
              <button onClick={() => onAnoChange(ano + 1)} style={yrBtn}>›</button>
            </div>
            <button onClick={onClose} style={{
              background:"none", border:"none", color:"var(--text-muted)",
              cursor:"pointer", fontSize:20, lineHeight:1, padding:4
            }}>×</button>
          </div>
        </div>

        {/* Lista dos 12 meses */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const mes = i + 1
            const lema = mesMap[mes]
            const isEditing = editingMes === mes

            return (
              <div key={mes} style={{
                padding:"10px 24px",
                borderBottom:"1px solid var(--border)",
                background: isEditing ? "var(--bg-active)" : "transparent",
                transition:"background 0.1s"
              }}>
                {/* Nome do mês */}
                <div style={{
                  fontSize:10, fontWeight:700, letterSpacing:"0.08em",
                  color: lema ? "#e6a817" : "var(--text-muted)",
                  textTransform:"uppercase", marginBottom:isEditing ? 8 : 4
                }}>
                  {MESES_PT[i]}
                </div>

                {isEditing ? (
                  /* Modo edição */
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder={`Lema de ${MESES_PT[i]}...`}
                      style={{
                        background:"var(--bg-surface)",
                        border:"1px solid var(--border)",
                        borderRadius:8, padding:"8px 10px",
                        color:"var(--text-primary)", fontSize:12,
                        width:"100%", outline:"none",
                        fontFamily:"inherit", resize:"vertical",
                        lineHeight:1.5
                      }}
                    />
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => saveEdit(mes)} disabled={saving}
                        style={{ padding:"6px 14px", borderRadius:7, border:"none",
                          background:"#3b82f6", color:"#fff",
                          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                        {saving ? "..." : "Salvar"}
                      </button>
                      <button onClick={cancelEdit}
                        style={{ padding:"6px 14px", borderRadius:7,
                          border:"1px solid var(--border)", background:"transparent",
                          color:"var(--text-secondary)",
                          fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                        Cancelar
                      </button>
                      {lema?.id && (
                        <button onClick={async () => {
                          if (!confirm("Remover lema?")) return
                          await fetch(`/api/agenda/lemas/${lema.id}`, { method:"DELETE" })
                          cancelEdit(); onSaved()
                        }}
                          style={{ padding:"6px 14px", borderRadius:7,
                            border:"1px solid #ef444430", background:"transparent",
                            color:"#ef4444",
                            fontSize:12, fontWeight:500, cursor:"pointer",
                            fontFamily:"inherit", marginLeft:"auto" }}>
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Modo visualização */
                  <div style={{ display:"flex", alignItems:"flex-start",
                    justifyContent:"space-between", gap:12 }}
                    onClick={() => startEdit(mes)}>
                    {lema ? (
                      <div style={{ fontSize:12, color:"var(--text-secondary)",
                        lineHeight:1.55, flex:1, cursor:"pointer" }}>
                        {lema.lema}
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:"var(--text-muted)",
                        fontStyle:"italic", cursor:"pointer" }}>
                        Clique para adicionar um lema...
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); startEdit(mes) }}
                      style={{ background:"none", border:"none", color:"var(--text-muted)",
                        cursor:"pointer", fontSize:12, padding:"2px 6px",
                        borderRadius:5, flexShrink:0, fontFamily:"inherit" }}>
                      ✎
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 24px", borderTop:"1px solid var(--border)",
          display:"flex", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:"7px 18px", borderRadius:8,
              border:"1px solid var(--border)", background:"transparent",
              color:"var(--text-secondary)",
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

const yrBtn: React.CSSProperties = {
  background:"var(--bg-active)", border:"1px solid var(--border)",
  borderRadius:6, width:26, height:26, display:"flex",
  alignItems:"center", justifyContent:"center",
  cursor:"pointer", fontSize:14, color:"var(--text-secondary)", fontFamily:"inherit"
}