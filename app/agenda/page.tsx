"use client"

import { useState, useEffect, useCallback } from "react"
import { LemasModal } from "./LemasModal"

// ── Types ──────────────────────────────────────────────────
type Categoria = { id: number; nome: string; cor: string; icone: string }
type Evento = {
    id: number
    titulo: string
    descricao: string | null
    data: string
    hora: string | null
    hora_fim: string | null
    local: string | null
    epoca_costume: string | null
    observacoes: string | null
    ativo: boolean
    id_categoria: number | null
    categoria_nome: string | null
    categoria_cor: string | null
    categoria_icone: string | null
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const FORM_VAZIO = {
    titulo: "", descricao: "", data: "", hora: "", hora_fim: "",
    local: "", id_categoria: "", epoca_costume: "", observacoes: ""
}

// ── Helpers ────────────────────────────────────────────────
function fmtData(iso: string) {
    const [y, m, d] = iso.split("T")[0].split("-")
    return `${d}/${m}/${y}`
}

function parseLocalDate(iso: string) {
    const [y, m, d] = iso.split("T")[0].split("-").map(Number)
    return new Date(y, m - 1, d)
}

function isoDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Modal ──────────────────────────────────────────────────
function Modal({
    open, onClose, categorias, editando, dataInicial, onSaved
}: {
    open: boolean
    onClose: () => void
    categorias: Categoria[]
    editando: Evento | null
    dataInicial: string
    onSaved: () => void
}) {
    const [form, setForm] = useState({ ...FORM_VAZIO })
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDel, setConfirmDel] = useState(false)

    useEffect(() => {
        if (editando) {
            setForm({
                titulo: editando.titulo,
                descricao: editando.descricao || "",
                data: editando.data.split("T")[0],
                hora: editando.hora || "",
                hora_fim: editando.hora_fim || "",
                local: editando.local || "",
                id_categoria: editando.id_categoria ? String(editando.id_categoria) : "",
                epoca_costume: editando.epoca_costume || "",
                observacoes: editando.observacoes || ""
            })
        } else {
            setForm({ ...FORM_VAZIO, data: dataInicial })
        }
        setConfirmDel(false)
    }, [editando, dataInicial, open])

    if (!open) return null

    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    async function salvar() {
        if (!form.titulo || !form.data) return
        setSaving(true)
        const url = editando ? `/api/agenda/${editando.id}` : "/api/agenda"
        const method = editando ? "PUT" : "POST"
        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, id_categoria: form.id_categoria ? Number(form.id_categoria) : null })
        })
        setSaving(false)
        onSaved()
        onClose()
    }

    async function excluir() {
        if (!editando) return
        setDeleting(true)
        await fetch(`/api/agenda/${editando.id}`, { method: "DELETE" })
        setDeleting(false)
        onSaved()
        onClose()
    }

    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: 28 }}>

                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                        {editando ? "Editar evento" : "Novo evento"}
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
                </div>

                {/* Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                    <Field label="Título *">
                        <input value={form.titulo} onChange={e => set("titulo", e.target.value)}
                            placeholder="Nome do evento"
                            style={inputStyle} autoFocus />
                    </Field>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Data *">
                            <input type="date" value={form.data} onChange={e => set("data", e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="Categoria">
                            <select value={form.id_categoria} onChange={e => set("id_categoria", e.target.value)} style={inputStyle}>
                                <option value="">— sem categoria —</option>
                                {categorias.map(c => (
                                    <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                                ))}
                            </select>
                        </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                        <Field label="Hora início">
                            <input type="time" value={form.hora} onChange={e => set("hora", e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="Hora fim">
                            <input type="time" value={form.hora_fim} onChange={e => set("hora_fim", e.target.value)} style={inputStyle} />
                        </Field>
                        <Field label="Local">
                            <input value={form.local} onChange={e => set("local", e.target.value)} placeholder="Local" style={inputStyle} />
                        </Field>
                    </div>

                    <Field label="Descrição">
                        <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)}
                            placeholder="Detalhes do evento..."
                            rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
                    </Field>

                    <Field label="Observações">
                        <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
                            placeholder="Notas internas..."
                            rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
                    </Field>

                    <Field label="Época / Costume" hint="Ex: 'Geralmente no 1º sábado de outubro'">
                        <textarea value={form.epoca_costume} onChange={e => set("epoca_costume", e.target.value)}
                            placeholder="Padrão histórico para auxiliar no planejamento do próximo ano..."
                            rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
                    </Field>

                </div>

                {/* Footer */}
                <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <div>
                        {editando && !confirmDel && (
                            <button onClick={() => setConfirmDel(true)}
                                style={{ ...btnStyle, background: "transparent", color: "#ef4444", border: "1px solid #ef444440" }}>
                                Excluir
                            </button>
                        )}
                        {editando && confirmDel && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={excluir} disabled={deleting}
                                    style={{ ...btnStyle, background: "#ef4444", color: "#fff", border: "none" }}>
                                    {deleting ? "Excluindo..." : "Confirmar exclusão"}
                                </button>
                                <button onClick={() => setConfirmDel(false)}
                                    style={{ ...btnStyle, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={onClose} style={{ ...btnStyle, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                            Cancelar
                        </button>
                        <button onClick={salvar} disabled={saving || !form.titulo || !form.data}
                            style={{ ...btnStyle, background: "#3b82f6", color: "#fff", border: "none", opacity: (!form.titulo || !form.data) ? 0.5 : 1 }}>
                            {saving ? "Salvando..." : editando ? "Salvar" : "Criar evento"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                {label}
            </label>
            {hint && <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: -3 }}>{hint}</span>}
            {children}
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    background: "var(--bg-active)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    color: "var(--text-primary)",
    fontSize: 13,
    width: "100%",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const
}

const btnStyle: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const
}

// ── Pill de evento ─────────────────────────────────────────
function EventoPill({ ev, onClick }: { ev: Evento; onClick: () => void }) {
    const cor = ev.categoria_cor || "#6b7280"
    return (
        <div onClick={e => { e.stopPropagation(); onClick() }}
            title={`${ev.titulo}${ev.hora ? ` · ${ev.hora}` : ""}${ev.local ? ` · ${ev.local}` : ""}`}
            style={{
                display: "flex", alignItems: "center", gap: 4,
                background: `${cor}18`, borderLeft: `2px solid ${cor}`,
                borderRadius: 4, padding: "2px 6px", marginBottom: 2,
                cursor: "pointer", transition: "background 0.12s",
                overflow: "hidden"
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${cor}30`)}
            onMouseLeave={e => (e.currentTarget.style.background = `${cor}18`)}
        >
            {ev.hora && (
                <span style={{ fontSize: 9, color: cor, fontFamily: "var(--mono)", fontWeight: 700, flexShrink: 0 }}>
                    {ev.hora}
                </span>
            )}
            <span style={{ fontSize: 10, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {ev.titulo}
            </span>
        </div>
    )
}

// ── Vista Calendário ───────────────────────────────────────
function ViewCalendario({ eventos, ano, mes, onDayClick, onEventClick }: {
    eventos: Evento[]
    ano: number
    mes: number
    onDayClick: (data: string) => void
    onEventClick: (ev: Evento) => void
}) {
    const hoje = new Date()
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const inicioGrid = new Date(primeiroDia)
    inicioGrid.setDate(inicioGrid.getDate() - inicioGrid.getDay())

    const fimGrid = new Date(ultimoDia)
    const resto = 6 - ultimoDia.getDay()
    if (resto > 0) fimGrid.setDate(fimGrid.getDate() + resto)

    const porDia: Record<string, Evento[]> = {}
    eventos.forEach(ev => {
        const k = ev.data.split("T")[0]
        if (!porDia[k]) porDia[k] = []
        porDia[k].push(ev)
    })

    const dias: Date[] = []
    const cur = new Date(inicioGrid)
    while (cur <= fimGrid) {
        dias.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
    }

    const semanas: Date[][] = []
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))

    return (
        <div style={{ flex: 1, overflow: "auto" }}>
            {/* Header dias semana */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
                {DIAS_SEMANA.map(d => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", padding: "6px 0", background: "var(--bg-surface)" }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid semanas */}
            {semanas.map((semana, si) => (
                <div key={si} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 1 }}>
                    {semana.map(dia => {
                        const isoK = isoDate(dia)
                        const fora = dia.getMonth() !== mes
                        const isHoje = isoK === isoDate(hoje)
                        const evsDia = porDia[isoK] || []
                        const MAX_VIS = 4

                        return (
                            <div key={isoK} onClick={() => onDayClick(isoK)}
                                style={{
                                    background: fora ? "var(--bg-surface)" : isHoje ? "rgba(59,130,246,0.06)" : "var(--bg-active)",
                                    border: isHoje ? "1px solid rgba(59,130,246,0.3)" : "1px solid var(--border)",
                                    borderRadius: 6, padding: "6px 6px 5px",
                                    minHeight: 90, cursor: "pointer",
                                    opacity: fora ? 0.35 : 1,
                                    transition: "background 0.1s"
                                }}
                                onMouseEnter={e => !fora && (e.currentTarget.style.background = isHoje ? "rgba(59,130,246,0.1)" : "var(--bg-surface)")}
                                onMouseLeave={e => !fora && (e.currentTarget.style.background = isHoje ? "rgba(59,130,246,0.06)" : "var(--bg-active)")}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                    <span style={{
                                        fontSize: 12, fontWeight: isHoje ? 700 : 400,
                                        color: isHoje ? "#3b82f6" : "var(--text-secondary)",
                                        width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
                                        borderRadius: "50%", background: isHoje ? "rgba(59,130,246,0.15)" : "transparent"
                                    }}>{dia.getDate()}</span>
                                    {evsDia.length > 0 && (
                                        <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
                                            {evsDia.length > MAX_VIS ? `+${evsDia.length}` : ""}
                                        </span>
                                    )}
                                </div>
                                {evsDia.slice(0, MAX_VIS).map(ev => (
                                    <EventoPill key={ev.id} ev={ev} onClick={() => onEventClick(ev)} />
                                ))}
                                {evsDia.length > MAX_VIS && (
                                    <div style={{ fontSize: 9, color: "var(--text-muted)", paddingLeft: 4 }}>
                                        +{evsDia.length - MAX_VIS} mais
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

// ── Vista Lista ────────────────────────────────────────────
function ViewLista({ eventos, onEventClick }: {
    eventos: Evento[]
    onEventClick: (ev: Evento) => void
}) {
    if (eventos.length === 0) {
        return (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Nenhum evento encontrado.
            </div>
        )
    }

    // Agrupar por data
    const grupos: Record<string, Evento[]> = {}
    eventos.forEach(ev => {
        const k = ev.data.split("T")[0]
        if (!grupos[k]) grupos[k] = []
        grupos[k].push(ev)
    })

    return (
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 32 }}>
            {Object.entries(grupos).map(([data, evs]) => {
                const d = parseLocalDate(data)
                const diaSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()]
                const hoje = isoDate(new Date())
                const isHoje = data === hoje

                return (
                    <div key={data} style={{ marginBottom: 20 }}>
                        {/* Cabeçalho do dia */}
                        <div style={{
                            display: "flex", alignItems: "baseline", gap: 8,
                            padding: "4px 0 8px",
                            borderBottom: `1px solid ${isHoje ? "rgba(59,130,246,0.3)" : "var(--border)"}`
                        }}>
                            <span style={{ fontSize: 20, fontWeight: 700, color: isHoje ? "#3b82f6" : "var(--text-primary)", fontFamily: "var(--mono)", letterSpacing: "-0.03em" }}>
                                {String(d.getDate()).padStart(2, "0")}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                {diaSemana} · {MESES[d.getMonth()]}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto", fontFamily: "var(--mono)" }}>
                                {evs.length} evento{evs.length > 1 ? "s" : ""}
                            </span>
                        </div>

                        {/* Eventos do dia */}
                        {evs.map(ev => {
                            const cor = ev.categoria_cor || "#6b7280"
                            return (
                                <div key={ev.id} onClick={() => onEventClick(ev)}
                                    style={{
                                        display: "grid", gridTemplateColumns: "auto 1fr auto",
                                        gap: 12, padding: "10px 12px",
                                        borderRadius: 8, marginTop: 4, cursor: "pointer",
                                        background: "var(--bg-active)", border: "1px solid var(--border)",
                                        transition: "border-color 0.12s, background 0.12s",
                                        alignItems: "start"
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = "var(--bg-surface)"
                                        e.currentTarget.style.borderColor = cor + "60"
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = "var(--bg-active)"
                                        e.currentTarget.style.borderColor = "var(--border)"
                                    }}
                                >
                                    {/* Horário */}
                                    <div style={{ textAlign: "right", minWidth: 42 }}>
                                        {ev.hora ? (
                                            <>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: cor, fontFamily: "var(--mono)" }}>{ev.hora}</div>
                                                {ev.hora_fim && <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{ev.hora_fim}</div>}
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>—</div>
                                        )}
                                    </div>

                                    {/* Conteúdo */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                                            {ev.titulo}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                                            {ev.local && (
                                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>📍 {ev.local}</span>
                                            )}
                                            {ev.categoria_nome && (
                                                <span style={{ fontSize: 11, color: cor }}>
                                                    {ev.categoria_icone} {ev.categoria_nome}
                                                </span>
                                            )}
                                        </div>
                                        {ev.descricao && (
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>{ev.descricao}</div>
                                        )}
                                        {ev.observacoes && (
                                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, fontStyle: "italic" }}>
                                                {ev.observacoes}
                                            </div>
                                        )}
                                    </div>

                                    {/* Seta */}
                                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>›</span>
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}

// ── Page ───────────────────────────────────────────────────
export default function AgendaPage() {
    const hoje = new Date()
    const [ano, setAno] = useState(hoje.getFullYear())
    const [mes, setMes] = useState(hoje.getMonth())
    const [view, setView] = useState<"calendario" | "lista">("calendario")
    const [eventos, setEventos] = useState<Evento[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editando, setEditando] = useState<Evento | null>(null)
    const [dataInicial, setDataInicial] = useState("")
    const [lemasOpen, setLemasOpen] = useState(false)
    const [lemas, setLemas] = useState<{ id?: number; mes: number; lema: string }[]>([])
    const [lemaAno, setLemaAno] = useState(hoje.getFullYear())

    async function carregarLemas(a = lemaAno) {
        const r = await fetch(`/api/agenda/lemas?ano=${a}`)
        setLemas(await r.json())
    }
    useEffect(() => {
        if (lemasOpen) carregarLemas(lemaAno)
    }, [lemasOpen, lemaAno])

    // Filtros lista
    const [filtroCategoria, setFiltroCategoria] = useState("")
    const [filtroLocal, setFiltroLocal] = useState("")
    const [filtroQ, setFiltroQ] = useState("")

    const carregar = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams({
            mes: String(mes + 1),
            ano: String(ano)
        })
        if (filtroCategoria) params.set("categoria_id", filtroCategoria)
        if (filtroLocal) params.set("local", filtroLocal)
        if (filtroQ) params.set("q", filtroQ)
        const res = await fetch(`/api/agenda?${params}`)
        setEventos(await res.json())
        setLoading(false)
    }, [ano, mes, filtroCategoria, filtroLocal, filtroQ])

    useEffect(() => { carregar() }, [carregar])

    useEffect(() => {
        fetch("/api/agenda/categorias").then(r => r.json()).then(setCategorias)
    }, [])

    function prevMes() {
        if (mes === 0) { setMes(11); setAno(a => a - 1) }
        else setMes(m => m - 1)
    }
    function nextMes() {
        if (mes === 11) { setMes(0); setAno(a => a + 1) }
        else setMes(m => m + 1)
    }

    function abrirNovoNaData(data: string) {
        setDataInicial(data)
        setEditando(null)
        setModalOpen(true)
    }

    function abrirEdicao(ev: Evento) {
        setEditando(ev)
        setDataInicial("")
        setModalOpen(true)
    }

    // Locais únicos para filtro
    const locaisUnicos = Array.from(new Set(eventos.map(e => e.local).filter(Boolean))) as string[]

    const totalEventos = eventos.length

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

            {/* ── Toolbar ─────────────────────────────────── */}
            <div style={{
                padding: "16px 20px 14px",
                borderBottom: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 12,
                background: "var(--bg-surface)", flexShrink: 0
            }}>
                {/* Linha 1: título + ações */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                            Agenda
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                            Paróquia Martin Luther · Cruzeiro do Sul
                        </div>
                    </div>
                    <div style={{ flex: 1 }} />

                    {/* Busca */}
                    <input
                        value={filtroQ}
                        onChange={e => setFiltroQ(e.target.value)}
                        placeholder="Buscar evento..."
                        style={{
                            background: "var(--bg-active)", border: "1px solid var(--border)",
                            borderRadius: 8, padding: "6px 12px", color: "var(--text-primary)",
                            fontSize: 12, width: 180, outline: "none", fontFamily: "inherit"
                        }}
                    />

                    {/* Toggle view */}
                    <div style={{ display: "flex", background: "var(--bg-active)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                        {(["calendario", "lista"] as const).map(v => (
                            <button key={v} onClick={() => setView(v)}
                                style={{
                                    padding: "6px 12px", border: "none", cursor: "pointer", fontFamily: "inherit",
                                    fontSize: 12, fontWeight: view === v ? 600 : 400,
                                    background: view === v ? "var(--bg-surface)" : "transparent",
                                    color: view === v ? "var(--text-primary)" : "var(--text-muted)",
                                    transition: "all 0.1s"
                                }}>
                                {v === "calendario" ? "◫ Calendário" : "≡ Lista"}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => setLemasOpen(true)} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "7px 13px", borderRadius: 8,
                        border: "1px solid #e6a81740", background: "#fffbeb", color: "#92400e",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                    }}>
                        ✦ Lemas
                    </button>

                    <button onClick={() => window.open(`/api/agenda/calendario-html?mes=${mes + 1}&ano=${ano}`, "_blank")} style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "7px 13px", borderRadius: 8,
                        border: "1px solid var(--border)", background: "var(--bg-active)", color: "var(--text-secondary)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
                    }}>
                        ⬇ Exportar
                    </button>

                    <button onClick={() => { setEditando(null); setDataInicial(isoDate(new Date())); setModalOpen(true) }}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "#3b82f6", color: "#fff", border: "none",
                            borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit"
                        }}>
                        + Novo evento
                    </button>
                </div>

                {/* Linha 2: navegação mês + filtros */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Nav mês */}
                    <button onClick={prevMes} style={navBtnStyle}>‹</button>
                    <div style={{ minWidth: 160, textAlign: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                            {MESES[mes]}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6, fontFamily: "var(--mono)" }}>
                            {ano}
                        </span>
                    </div>
                    <button onClick={nextMes} style={navBtnStyle}>›</button>
                    <button onClick={() => { setAno(hoje.getFullYear()); setMes(hoje.getMonth()) }}
                        style={{ ...navBtnStyle, fontSize: 11, padding: "4px 10px", color: "var(--text-muted)" }}>
                        Hoje
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* Filtro categoria */}
                    <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
                        style={{ ...filterSelect }}>
                        <option value="">Todas categorias</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                    </select>

                    {/* Filtro local */}
                    <select value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}
                        style={{ ...filterSelect }}>
                        <option value="">Todos os locais</option>
                        {locaisUnicos.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>

                    {/* Total */}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)", flexShrink: 0 }}>
                        {loading ? "..." : `${totalEventos} evento${totalEventos !== 1 ? "s" : ""}`}
                    </span>

                    {/* Limpar filtros */}
                    {(filtroCategoria || filtroLocal || filtroQ) && (
                        <button onClick={() => { setFiltroCategoria(""); setFiltroLocal(""); setFiltroQ("") }}
                            style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            × Limpar
                        </button>
                    )}
                </div>
            </div>

            {/* ── Content ─────────────────────────────────── */}
            <div style={{ flex: 1, overflow: "hidden", padding: "12px 20px 0", display: "flex", flexDirection: "column" }}>
                {loading ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, gap: 8 }}>
                        <span style={{ opacity: 0.5 }}>carregando...</span>
                    </div>
                ) : view === "calendario" ? (
                    <ViewCalendario
                        eventos={eventos} ano={ano} mes={mes}
                        onDayClick={abrirNovoNaData}
                        onEventClick={abrirEdicao}
                    />
                ) : (
                    <ViewLista eventos={eventos} onEventClick={abrirEdicao} />
                )}
            </div>

            {/* Modal */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                categorias={categorias}
                editando={editando}
                dataInicial={dataInicial}
                onSaved={carregar}
            />
            <LemasModal
                open={lemasOpen}
                onClose={() => setLemasOpen(false)}
                lemas={lemas}
                ano={lemaAno}
                onAnoChange={a => { setLemaAno(a); carregarLemas(a) }}
                onSaved={() => carregarLemas()}
            />
        </div>
    )
}

const navBtnStyle: React.CSSProperties = {
    background: "var(--bg-active)", border: "1px solid var(--border)",
    borderRadius: 6, padding: "4px 8px", color: "var(--text-secondary)",
    cursor: "pointer", fontSize: 16, fontFamily: "inherit", lineHeight: 1
}

const filterSelect: React.CSSProperties = {
    background: "var(--bg-active)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "6px 10px", color: "var(--text-secondary)",
    fontSize: 11, outline: "none", fontFamily: "inherit", cursor: "pointer"
}