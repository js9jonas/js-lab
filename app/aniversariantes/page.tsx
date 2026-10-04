"use client"

import { useState, useEffect, useCallback } from "react"
import { GRUPOS, type PlanoImport } from "@/lib/aniversariantesImport"

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Aniversariante {
    id: number
    nome: string
    telefone: string | null
    data_nasc: string        // ISO: "1984-01-04"
    grupo: string | null
    ativo: boolean
    observacao: string | null
    idade: number | null     // null quando o ano é desconhecido
    ano_desconhecido: boolean
    dia_mes: string          // "04/01"
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

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
        ano_desconhecido: item?.ano_desconhecido ?? false,
    })
    const [saving, setSaving] = useState(false)

    const field = (key: keyof typeof form, label: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>, sanitize?: (v: string) => string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                {label.toUpperCase()}
            </label>
            <input
                type={type}
                value={String(form[key])}
                onChange={e => setForm(f => ({ ...f, [key]: sanitize ? sanitize(e.target.value) : e.target.value }))}
                style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                {...extra}
            />
        </div>
    )

    // remove tudo que não for dígito (espaços, "-", "+", parênteses etc.) — usado no colar do telefone
    const soDigitos = (v: string) => v.replace(/\D/g, "")

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
                {field("telefone", "WhatsApp", "text", { placeholder: "5551999999999" }, soDigitos)}
                {form.ano_desconhecido ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>ANIVERSÁRIO (DIA E MÊS)</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            <select value={form.data_nasc ? Number(form.data_nasc.slice(8, 10)) : ""}
                                onChange={e => setForm(f => ({ ...f, data_nasc: `2000-${(f.data_nasc || "2000-01-01").slice(5, 7)}-${String(e.target.value).padStart(2, "0")}` }))}
                                style={{ flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13 }}>
                                <option value="" disabled>Dia</option>
                                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                            </select>
                            <select value={form.data_nasc ? Number(form.data_nasc.slice(5, 7)) : ""}
                                onChange={e => setForm(f => ({ ...f, data_nasc: `2000-${String(e.target.value).padStart(2, "0")}-${(f.data_nasc || "2000-01-01").slice(8, 10)}` }))}
                                style={{ flex: 2, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13 }}>
                                <option value="" disabled>Mês</option>
                                {MESES_LONGOS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                ) : field("data_nasc", "Data de nascimento", "date")}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", marginTop: -8 }}>
                    <input type="checkbox" checked={form.ano_desconhecido}
                        onChange={e => setForm(f => ({ ...f, ano_desconhecido: e.target.checked, data_nasc: f.data_nasc && e.target.checked ? `2000${f.data_nasc.slice(4)}` : f.data_nasc }))} />
                    Não sei o ano (só dia e mês — a idade não aparece)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>GRUPO</label>
                    <select value={form.grupo} onChange={e => setForm(f => ({ ...f, grupo: e.target.value }))}
                        style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text-primary)", fontSize: 13 }}>
                        <option value="">Sem grupo</option>
                        {[...GRUPOS, ...(form.grupo && !(GRUPOS as readonly string[]).includes(form.grupo) ? [form.grupo] : [])].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {form.grupo === "MEMBRO CRUZEIRO" && isNew && (
                        <span style={{ fontSize: 11, color: "#d97706" }}>Membros vêm do cadastro da comunidade — quem não estiver lá sai na próxima sincronização.</span>
                    )}
                </div>
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

// ─── Sincronização com o cadastro de membros (js-comunidade) ───────────────────

type PlanoSync = {
    entram: { ref: string; nome: string; data_nasc: string; telefone: string | null; origem_tel: string | null; dependente_de: string | null }[]
    saem: { id: number; nome: string; motivo: string }[]
    nomes: { id: number; de: string; para: string }[]
    telefones: { id: number; nome: string; de: string | null; para: string; origem: string }[]
    datas_diferentes: { id: number; nome: string; lista: string; cadastro: string }[]
    vincular: { id: number; ref: string }[]
    sem_data_nascimento: number
    sem_telefone_depois: number
    assinatura: string
}

const fmtData = (d: string) => d.split("-").reverse().join("/")
const fmtTel = (t: string | null) => (t ? `(${t.slice(2, 4)}) ${t.slice(4, -4)}-${t.slice(-4)}` : "sem telefone")

function ModalSincronizar({ onClose, onAplicado }: { onClose: () => void; onAplicado: (msg: string) => void }) {
    const [plano, setPlano] = useState<PlanoSync | null>(null)
    const [erro, setErro] = useState("")
    const [aplicando, setAplicando] = useState(false)

    const carregar = useCallback(async () => {
        setErro(""); setPlano(null)
        try {
            const res = await fetch("/api/aniversariantes/sincronizar")
            const data = await res.json()
            if (!res.ok) { setErro(data.error || "Não foi possível calcular a sincronização."); return }
            setPlano(data)
        } catch { setErro("Falha de conexão. Tente de novo.") }
    }, [])
    useEffect(() => { carregar() }, [carregar])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !aplicando) onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose, aplicando])

    async function aplicar() {
        if (!plano) return
        setAplicando(true); setErro("")
        try {
            const res = await fetch("/api/aniversariantes/sincronizar", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assinatura: plano.assinatura }),
            })
            const data = await res.json()
            if (res.status === 409) { setErro(data.error); carregar(); return }
            if (!res.ok) { setErro(data.error || "Erro ao aplicar."); return }
            onAplicado(`Sincronizado: ${data.entraram} entraram, ${data.sairam} saíram, ${data.telefones} telefones e ${data.nomes} nomes atualizados.`)
        } catch { setErro("Falha de conexão. Tente de novo.") }
        finally { setAplicando(false) }
    }

    const temMudanca = !!plano && (plano.entram.length + plano.saem.length + plano.nomes.length + plano.telefones.length + plano.vincular.length) > 0
    const secao = (titulo: string, cor: string, itens: React.ReactNode[]) => itens.length === 0 ? null : (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cor, marginBottom: 6 }}>{titulo} ({itens.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "var(--text-primary)" }}>{itens}</div>
        </div>
    )

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Sincronizar com o cadastro de membros</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                        Grupo MEMBRO CRUZEIRO × cadastro do js-comunidade. Confira as mudanças; nada é gravado até clicar em Aplicar.
                    </div>
                </div>
                <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                    {!plano && !erro && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Calculando…</div>}
                    {plano && !temMudanca && (
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>A lista já está igual ao cadastro. Nada para mudar.</div>
                    )}
                    {plano && <>
                        {secao("Entram", "#16a34a", plano.entram.map(e => (
                            <div key={e.ref}>{e.nome} · {fmtData(e.data_nasc)} · {fmtTel(e.telefone)}
                                {e.origem_tel === "titular" ? " (do titular)" : ""}{e.dependente_de ? ` · dependente de ${e.dependente_de}` : ""}</div>
                        )))}
                        {secao("Saem", "#dc2626", plano.saem.map(s => <div key={s.id}>{s.nome} · {s.motivo}</div>))}
                        {secao("Nome atualizado conforme o cadastro", "#2563eb", plano.nomes.map(n => <div key={n.id}>{n.de} → {n.para}</div>))}
                        {secao("Telefone", "#2563eb", plano.telefones.map(t => (
                            <div key={t.id}>{t.nome}: {t.de ? `${t.de} → ` : ""}{fmtTel(t.para)} ({t.origem === "titular" ? "do titular" : t.origem})</div>
                        )))}
                        {secao("Data diferente do cadastro (não muda; a lista é que vale)", "#d97706", plano.datas_diferentes.map(d => (
                            <div key={d.id}>{d.nome}: lista {d.lista} · cadastro {d.cadastro}</div>
                        )))}
                        {plano.vincular.length > 0 && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                                {plano.vincular.length} registros serão ligados ao cadastro (as próximas sincronizações não dependem do nome).
                            </div>
                        )}
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {plano.sem_data_nascimento > 0 && <div>{plano.sem_data_nascimento} membros ativos sem data de nascimento no cadastro não entram na lista.</div>}
                            <div>Depois de aplicar, {plano.sem_telefone_depois} ficam sem telefone com WhatsApp.</div>
                        </div>
                    </>}
                    {erro && <div style={{ marginTop: 12, fontSize: 13, color: "#dc2626" }}>{erro}</div>}
                </div>
                <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={onClose} disabled={aplicando}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
                        {temMudanca ? "Cancelar" : "Fechar"}
                    </button>
                    {temMudanca && (
                        <button onClick={aplicar} disabled={aplicando}
                            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: aplicando ? "progress" : "pointer", opacity: aplicando ? 0.6 : 1 }}>
                            {aplicando ? "Aplicando…" : "Aplicar"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Importar lista (CLIENTE / AMIGO - FAMÍLIA, grupo automático) ──────────────

function ModalImportar({ onClose, onAplicado }: { onClose: () => void; onAplicado: (msg: string) => void }) {
    const [texto, setTexto] = useState("")
    const [plano, setPlano] = useState<PlanoImport | null>(null)
    const [erro, setErro] = useState("")
    const [ocupado, setOcupado] = useState(false)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose, ocupado])

    async function enviar(aplicar: boolean) {
        setOcupado(true); setErro("")
        try {
            const res = await fetch("/api/aniversariantes/importar", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto, aplicar }),
            })
            const data = await res.json()
            if (!res.ok) { setErro(data.error || "Erro."); return }
            if (aplicar) onAplicado(`Importados ${data.inseridos} aniversariantes.`)
            else setPlano(data)
        } catch { setErro("Falha de conexão. Tente de novo.") }
        finally { setOcupado(false) }
    }

    async function lerArquivo(f: File | undefined) {
        if (!f) return
        setTexto(await f.text()); setPlano(null)
    }

    const fmt = (d: string, semAno: boolean) => semAno ? d.slice(5).split("-").reverse().join("/") : d.split("-").reverse().join("/")
    const secao = (titulo: string, cor: string, itens: React.ReactNode[]) => itens.length === 0 ? null : (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cor, marginBottom: 6 }}>{titulo} ({itens.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12 }}>{itens}</div>
        </div>
    )

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Importar lista</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                        Uma pessoa por linha: <code>Nome; DD/MM/AAAA; telefone</code>. O ano e o telefone são opcionais (<code>Maria Souza; 15/03</code>).
                        Também aceita CSV. Grupo automático: telefone com assinatura ativa no js-painel vira CLIENTE, os demais AMIGO - FAMÍLIA.
                        Nada é gravado até clicar em Importar.
                    </div>
                </div>
                <div style={{ padding: 20, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ marginLeft: "auto", fontSize: 12, color: "#2563eb", cursor: "pointer" }}>
                            Abrir arquivo CSV…
                            <input type="file" accept=".csv,.txt,text/csv,text/plain" style={{ display: "none" }} onChange={e => lerArquivo(e.target.files?.[0])} />
                        </label>
                    </div>
                    <textarea value={texto} onChange={e => { setTexto(e.target.value); setPlano(null) }} rows={8}
                        placeholder={"Maria Souza; 15/03/1980; 51999999999\nJoão Pereira; 02/11"}
                        style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", resize: "vertical" }} />
                    {plano && <div>
                        {plano.novos.length + plano.ja_na_lista.length + plano.erros.length === 0 && (
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma linha com conteúdo.</div>
                        )}
                        {secao("Entram", "#16a34a", plano.novos.map(n => (
                            <div key={n.linha}>
                                {n.nome} · {fmt(n.data_nasc, n.ano_desconhecido)}{n.ano_desconhecido ? " (sem ano)" : ""} · {n.telefone ?? "sem telefone"} · <b>{n.grupo}</b>
                                {n.avisos.map((a, i) => <div key={i} style={{ color: "#d97706", fontSize: 11, marginLeft: 10 }}>⚠ {a}</div>)}
                            </div>
                        )))}
                        {secao("Já estão na lista (não mudam)", "#2563eb", plano.ja_na_lista.map(j => (
                            <div key={j.linha}>Linha {j.linha}: {j.nome} · {j.grupo ?? "sem grupo"}</div>
                        )))}
                        {secao("Linhas com erro (ficam de fora)", "#dc2626", plano.erros.map(e => (
                            <div key={e.linha}>Linha {e.linha}: {e.motivo} — <span style={{ color: "var(--text-muted)" }}>{e.texto}</span></div>
                        )))}
                    </div>}
                    {erro && <div style={{ fontSize: 13, color: "#dc2626" }}>{erro}</div>}
                </div>
                <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={onClose} disabled={ocupado}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
                        Cancelar
                    </button>
                    {!plano ? (
                        <button onClick={() => enviar(false)} disabled={ocupado || !texto.trim()}
                            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: ocupado || !texto.trim() ? 0.6 : 1 }}>
                            {ocupado ? "Conferindo…" : "Conferir"}
                        </button>
                    ) : plano.novos.length > 0 && (
                        <button onClick={() => enviar(true)} disabled={ocupado}
                            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: ocupado ? "progress" : "pointer", opacity: ocupado ? 0.6 : 1 }}>
                            {ocupado ? "Importando…" : `Importar ${plano.novos.length}`}
                        </button>
                    )}
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
    const [sincronizando, setSincronizando] = useState(false)
    const [importando, setImportando] = useState(false)
    const [aviso, setAviso] = useState("")

    // ── grupos únicos para o select ──
    const grupos = Array.from(new Set([...GRUPOS, ...(lista.map(a => a.grupo).filter(Boolean) as string[])]))

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
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        onClick={() => setSincronizando(true)}
                        title="Confere quem entrou e quem saiu do grupo MEMBRO CRUZEIRO no cadastro de membros"
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ⟳ Sincronizar com cadastro
                    </button>
                    <button
                        onClick={() => setImportando(true)}
                        title="Colar uma lista de clientes, família ou amigos"
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        ⇪ Importar lista
                    </button>
                    <button
                        onClick={() => setModal({})}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        + Adicionar
                    </button>
                </div>
            </div>
            {aviso && (
                <div style={{ padding: "10px 28px", background: "rgba(22,163,74,.12)", color: "#16a34a", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{aviso}</span>
                    <button onClick={() => setAviso("")} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}>✕</button>
                </div>
            )}
            {importando && (
                <ModalImportar
                    onClose={() => setImportando(false)}
                    onAplicado={msg => { setImportando(false); setAviso(msg); carregar() }}
                />
            )}
            {sincronizando && (
                <ModalSincronizar
                    onClose={() => setSincronizando(false)}
                    onAplicado={msg => { setSincronizando(false); setAviso(msg); carregar() }}
                />
            )}

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
                                        {a.idade != null && <span style={{ marginLeft: 4 }}>({a.idade} anos)</span>}
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