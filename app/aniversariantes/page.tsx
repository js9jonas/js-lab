"use client"

import { useState, useEffect, useCallback } from "react"

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Aniversariante {
    id: number
    nome: string
    telefone: string | null
    data_nasc: string        // ISO: "1984-01-04"
    grupo: string | null
    ativo: boolean
    observacao: string | null
    idade: number
    dia_mes: string          // "04/01"
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

// ─── Modal de Edição / Criação ─────────────────────────────────────────────────

function Modal({ item, onClose, onSave }: {
    item: Partial<Aniversariante> | null
    onClose: () => void
    onSave: (data: Partial<Aniversariante>) => Promise<void>
}) {
    const isNew = !item?.id
    const [form, setForm] = useState({
        nome: item?.nome ?? "",
        telefone: item?.telefone ?? "",
        data_nasc: item?.data_nasc ? item.data_nasc.split("T")[0] : "",
        grupo: item?.grupo ?? "",
        observacao: item?.observacao ?? "",
        ativo: item?.ativo ?? true,
    })
    const [saving, setSaving] = useState(false)

    const field = (key: keyof typeof form, label: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                {label.toUpperCase()}
            </label>
            <input
                type={type}
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                {...extra}
            />
        </div>
    )

    return (
        <div style={{ position: "fixed", inset: 0, background: "#00000066", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 28, width: 440, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Cabeçalho */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{isNew ? "Novo cadastro" : "Editar cadastro"}</div>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
                </div>

                {/* Campos */}
                {field("nome", "Nome completo")}
                {field("telefone", "WhatsApp", "text", { placeholder: "5551999999999" })}
                {field("data_nasc", "Data de nascimento", "date")}
                {field("grupo", "Grupo")}
                {field("observacao", "Observação")}

                {/* Ativo toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                        onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                        style={{ width: 38, height: 22, borderRadius: 99, background: form.ativo ? "#16a34a" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ position: "absolute", top: 3, left: form.ativo ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Cadastro {form.ativo ? "ativo" : "inativo"}</span>
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={onClose}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
                        Cancelar
                    </button>
                    <button
                        disabled={saving || !form.nome || !form.data_nasc}
                        onClick={async () => { setSaving(true); await onSave({ ...form, id: item?.id }); setSaving(false) }}
                        style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                        {saving ? "Salvando…" : "Salvar"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function AniversariantesPage() {
    const [lista, setLista] = useState<Aniversariante[]>([])
    const [search, setSearch] = useState("")
    const [filtroG, setFiltroG] = useState("")
    const [filtroM, setFiltroM] = useState("")
    const [soAtivos, setSoAtivos] = useState(true)
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState<Partial<Aniversariante> | null | false>(false)

    // ── grupos únicos para o select ──
    const grupos = Array.from(new Set(lista.map(a => a.grupo).filter(Boolean) as string[])).sort()

    // ── fetch ──────────────────────────────────────────────────────────────────
    const carregar = useCallback(async () => {
        setLoading(true)
        const p = new URLSearchParams()
        if (search) p.set("search", search)
        if (filtroG) p.set("grupo", filtroG)
        if (filtroM) p.set("mes", filtroM)
        if (soAtivos) p.set("ativo", "true")

        const res = await fetch(`/api/aniversariantes?${p}`)
        const data = await res.json()
        setLista(Array.isArray(data) ? data : [])
        setLoading(false)
    }, [search, filtroG, filtroM, soAtivos])

    useEffect(() => { carregar() }, [carregar])

    // ── stats ──────────────────────────────────────────────────────────────────
    const hoje = new Date()
    const hojeNorm = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const mesAtual = hoje.getMonth() + 1
    const diaAtual = hoje.getDate()
    const proximos = lista.filter(a => {
        const [dd, mm] = a.dia_mes.split("/").map(Number)
        let bday = new Date(hojeNorm.getFullYear(), mm - 1, dd)
        if (bday < hojeNorm) bday = new Date(hojeNorm.getFullYear() + 1, mm - 1, dd)
        const diff = Math.floor((bday.getTime() - hojeNorm.getTime()) / (1000 * 60 * 60 * 24))
        return diff >= 0 && diff <= 7
    })
    const estesMes = lista.filter(a => Number(a.dia_mes.split("/")[1]) === mesAtual)

    // ── salvar (criar ou editar) ───────────────────────────────────────────────
    async function salvar(data: Partial<Aniversariante>) {
        const isNew = !data.id
        const url = isNew ? "/api/aniversariantes" : `/api/aniversariantes/${data.id}`
        const method = isNew ? "POST" : "PATCH"
        await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        setModal(false)
        carregar()
    }

    // ── toggle ativo ──────────────────────────────────────────────────────────
    async function toggleAtivo(a: Aniversariante) {
        await fetch(`/api/aniversariantes/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ativo: !a.ativo }),
        })
        carregar()
    }

    // ── deletar ───────────────────────────────────────────────────────────────
    async function deletar(id: number) {
        if (!confirm("Remover este cadastro?")) return
        await fetch(`/api/aniversariantes/${id}`, { method: "DELETE" })
        carregar()
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    const selectStyle: React.CSSProperties = {
        background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8,
        padding: "7px 10px", color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none",
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

            {/* ── Topbar ── */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>🎂 Aniversariantes</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        Cadastro e controle de datas de nascimento
                    </div>
                </div>
                <button
                    onClick={() => setModal({})}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    + Adicionar
                </button>
            </div>

            {/* ── Conteúdo ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                        { label: "Total cadastros", value: lista.length, color: "#2563eb" },
                        { label: `Mês atual (${MESES[mesAtual - 1]})`, value: estesMes.length, color: "#d97706" },
                        { label: "Próximos 7 dias", value: proximos.length, color: "#16a34a" },
                        { label: "Sem telefone", value: lista.filter(a => !a.telefone).length, color: "#dc2626" },
                    ].map(s => (
                        <div key={s.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <input
                        placeholder="Buscar por nome…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...selectStyle, flex: 1, minWidth: 180 }}
                    />
                    <select value={filtroG} onChange={e => setFiltroG(e.target.value)} style={selectStyle}>
                        <option value="">Todos os grupos</option>
                        {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={filtroM} onChange={e => setFiltroM(e.target.value)} style={selectStyle}>
                        <option value="">Todos os meses</option>
                        {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                        <input type="checkbox" checked={soAtivos} onChange={e => setSoAtivos(e.target.checked)} />
                        Só ativos
                    </label>
                </div>

                {/* Tabela */}
                {loading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>Carregando…</div>
                ) : lista.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>Nenhum registro encontrado.</div>
                ) : (
                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                        {/* Cabeçalho */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 140px 60px 80px", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                            <span>NOME</span>
                            <span>DATA</span>
                            <span>GRUPO</span>
                            <span>WHATSAPP</span>
                            <span>ATIVO</span>
                            <span></span>
                        </div>

                        {/* Linhas */}
                        {lista.map((a, i) => {
                            const isHoje = a.dia_mes === `${String(diaAtual).padStart(2, "0")}/${String(mesAtual).padStart(2, "0")}`
                            return (
                                <div key={a.id}
                                    style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 140px 60px 80px", padding: "11px 16px", borderBottom: i < lista.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", background: isHoje ? "#fefce8" : undefined, fontSize: 13 }}>

                                    {/* Nome */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        {isHoje && <span style={{ fontSize: 14 }}>🎂</span>}
                                        <div>
                                            <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{a.nome}</div>
                                            {a.observacao && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.observacao}</div>}
                                        </div>
                                    </div>

                                    {/* Data */}
                                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.dia_mes}</span>
                                        <span style={{ marginLeft: 4 }}>({a.idade} anos)</span>
                                    </div>

                                    {/* Grupo */}
                                    <div>
                                        {a.grupo
                                            ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--border)", color: "var(--text-muted)" }}>{a.grupo}</span>
                                            : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                                        }
                                    </div>

                                    {/* Telefone */}
                                    <div style={{ fontSize: 12, color: a.telefone ? "var(--text-primary)" : "#dc2626" }}>
                                        {a.telefone ?? "⚠ sem número"}
                                    </div>

                                    {/* Toggle ativo */}
                                    <div>
                                        <div onClick={() => toggleAtivo(a)}
                                            style={{ width: 34, height: 20, borderRadius: 99, background: a.ativo ? "#16a34a" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                                            <div style={{ position: "absolute", top: 2, left: a.ativo ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                                        </div>
                                    </div>

                                    {/* Ações */}
                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                        <button
                                            onClick={() => setModal(a)}
                                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 }}>
                                            ✏
                                        </button>
                                        <button
                                            onClick={() => deletar(a.id)}
                                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #fecaca", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 11 }}>
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Contador */}
                {!loading && lista.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                        {lista.length} registro{lista.length !== 1 ? "s" : ""}
                    </div>
                )}
            </div>

            {/* Modal */}
            {modal !== false && (
                <Modal
                    item={modal || {}}
                    onClose={() => setModal(false)}
                    onSave={salvar}
                />
            )}
        </div>
    )
}