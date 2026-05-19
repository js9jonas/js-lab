"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import type { Rifa, RifaOrganizacao, RifaPremio, RifaPayload, Tema } from "../types"
import { TEMAS } from "../types"
import RifaPrintLayout from "./RifaPrintLayout"

const FONTES = ["Arial", "Georgia", "Montserrat", "Times New Roman"]
const BORDAS = [
  { value: "simples", label: "Simples" },
  { value: "grossa", label: "Grossa" },
  { value: "dupla", label: "Dupla" },
  { value: "arredondada", label: "Arredondada" },
  { value: "sem", label: "Sem borda" },
]
const FUNDOS = [
  { value: "branco", label: "Branco" },
  { value: "cinza-claro", label: "Cinza claro" },
  { value: "cinza-medio", label: "Cinza médio" },
]

function input(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13,
    border: "1px solid var(--border)", background: "var(--bg-surface)",
    color: "var(--text-primary)", outline: "none", ...extra,
  }
}

function label(text: string) {
  return <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>{text}</label>
}

function Field({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label(title)}
      {children}
    </div>
  )
}

interface Props {
  rifaInicial?: Rifa
}

const DEFAULTS: RifaPayload = {
  organizacao_id: null,
  titulo: "Ação entre Amigos",
  detalhes: "",
  valor_numero: 3,
  data_sorteio: null,
  local_sorteio: "",
  numero_inicial: 1,
  quantidade_total: 100,
  numeros_por_pagina: 20,
  colunas_premios: 2,
  tema: "classico",
  fonte: "Arial",
  borda_estilo: "simples",
  zebrado: true,
  emoji_premios: false,
  fundo_cabecalho: "cinza-claro",
  orientacao: "retrato",
  tamanho_papel: "A4",
  premios: [],
}

export default function RifaFormPage({ rifaInicial }: Props) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<RifaOrganizacao[]>([])
  const [form, setForm] = useState<RifaPayload>({
    ...DEFAULTS,
    ...rifaInicial,
    data_sorteio: rifaInicial?.data_sorteio
      ? String(rifaInicial.data_sorteio).split('T')[0]
      : null,
  })
  const [premios, setPremios] = useState<RifaPremio[]>(rifaInicial?.premios ?? [])
  const [orgSelecionada, setOrgSelecionada] = useState<RifaOrganizacao | undefined>(rifaInicial?.organizacao)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [previewEscala, setPreviewEscala] = useState(0.48)
  const premioRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusPremioIdx, setFocusPremioIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/rifas/organizacoes").then(r => r.json()).then(setOrgs)
  }, [])

  useEffect(() => {
    const org = orgs.find(o => o.id === form.organizacao_id)
    setOrgSelecionada(org)
  }, [form.organizacao_id, orgs])

  function set<K extends keyof RifaPayload>(key: K, value: RifaPayload[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function aplicarTema(tema: Tema) {
    setForm(prev => ({ ...prev, tema, ...TEMAS[tema] }))
  }

  function addPremio(comFoco = false) {
    const novoIdx = premios.length
    setPremios(prev => [...prev, { posicao: prev.length + 1, descricao: "" }])
    if (comFoco) setFocusPremioIdx(novoIdx)
  }

  useEffect(() => {
    if (focusPremioIdx !== null) {
      premioRefs.current[focusPremioIdx]?.focus()
      setFocusPremioIdx(null)
    }
  }, [focusPremioIdx, premios])

  function removePremio(i: number) {
    setPremios(prev => {
      const next = prev.filter((_, j) => j !== i)
      return next.map((p, j) => ({ ...p, posicao: j + 1 }))
    })
  }

  function updatePremio(i: number, descricao: string) {
    setPremios(prev => prev.map((p, j) => j === i ? { ...p, descricao } : p))
  }

  async function handleSave() {
    if (!form.titulo.trim()) { setError("Título obrigatório"); return }
    setSaving(true); setError("")
    try {
      const payload = { ...form, premios }
      const url = rifaInicial?.id ? `/api/rifas/${rifaInicial.id}` : "/api/rifas"
      const method = rifaInicial?.id ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const rifa = await res.json()
      router.push(`/rifas/${rifa.id}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const totalPaginas = Math.ceil(form.quantidade_total / form.numeros_por_pagina)

  return (
    <div style={{ display: "flex", height: "100%", gap: 0, minHeight: 0 }}>
      {/* ── FORMULÁRIO ─────────────────────────────────────── */}
      <div style={{ width: 380, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto", padding: "20px 18px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--text-primary)" }}>
          {rifaInicial?.id ? "Editar Rifa" : "Nova Rifa"}
        </div>

        {/* Organização */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>ORGANIZAÇÃO</div>
          <Field title="Organização">
            <select value={form.organizacao_id ?? ""} onChange={e => set("organizacao_id", e.target.value ? Number(e.target.value) : null)} style={input()}>
              <option value="">— Selecionar —</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </Field>
          <button onClick={() => setShowOrgModal(true)} style={{ fontSize: 11, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            + Nova organização
          </button>
        </div>

        {/* Dados */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>DADOS DA RIFA</div>
          <Field title="Título *">
            <input value={form.titulo} onChange={e => set("titulo", e.target.value)} style={input()} placeholder="Ex: Ação entre Amigos da OASE" />
          </Field>
          <Field title="Detalhes">
            <textarea value={form.detalhes ?? ""} onChange={e => set("detalhes", e.target.value)} rows={2} style={{ ...input(), resize: "vertical" }} placeholder="Descrição opcional..." />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field title="Valor por número (R$)">
              <input type="number" step="0.50" min="0" value={form.valor_numero} onChange={e => set("valor_numero", Number(e.target.value))} style={input()} />
            </Field>
            <Field title="Número inicial">
              <input type="number" min="1" value={form.numero_inicial} onChange={e => set("numero_inicial", Number(e.target.value))} style={input()} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field title="Data do sorteio">
              <input type="date" value={form.data_sorteio ?? ""} onChange={e => set("data_sorteio", e.target.value || null)} style={input()} />
            </Field>
            <Field title="Local do sorteio">
              <input value={form.local_sorteio ?? ""} onChange={e => set("local_sorteio", e.target.value)} style={input()} placeholder="Ex: CHA da OASE" />
            </Field>
          </div>
        </div>

        {/* Configuração de páginas */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>CONFIGURAÇÃO</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field title="Quantidade total">
              <input type="number" min="1" value={form.quantidade_total} onChange={e => set("quantidade_total", Number(e.target.value))} style={input()} />
            </Field>
            <Field title="Números por página">
              <input type="number" min="5" max="50" value={form.numeros_por_pagina} onChange={e => set("numeros_por_pagina", Number(e.target.value))} style={input()} />
            </Field>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-active)", borderRadius: 6, padding: "6px 10px" }}>
            → <strong>{totalPaginas} páginas</strong> · {form.quantidade_total} bilhetes no total
          </div>
        </div>

        {/* Prêmios */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>PRÊMIOS ({premios.length})</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Colunas:</label>
              <select value={form.colunas_premios} onChange={e => set("colunas_premios", Number(e.target.value))} style={{ ...input({ width: "auto" }), padding: "3px 6px" }}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {premios.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", width: 22, textAlign: "right", flexShrink: 0 }}>{p.posicao}°</span>
              <input
                ref={el => { premioRefs.current[i] = el }}
                value={p.descricao}
                onChange={e => updatePremio(i, e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPremio(true) } }}
                style={{ ...input(), flex: 1 }}
                placeholder={`Prêmio ${p.posicao}...`}
              />
              <button onClick={() => removePremio(i)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button onClick={() => addPremio(true)} style={{ marginTop: 4, fontSize: 11, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            + Adicionar prêmio
          </button>
        </div>

        {/* Visual */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>VISUAL</div>

          {/* Temas */}
          <Field title="Tema">
            <div style={{ display: "flex", gap: 6 }}>
              {(["classico", "festivo", "elegante"] as Tema[]).map(t => (
                <button
                  key={t}
                  onClick={() => aplicarTema(t)}
                  style={{
                    flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, cursor: "pointer",
                    border: form.tema === t ? "2px solid var(--blue)" : "1px solid var(--border)",
                    background: form.tema === t ? "#eff6ff" : "var(--bg-surface)",
                    fontWeight: form.tema === t ? 700 : 400,
                    color: form.tema === t ? "var(--blue)" : "var(--text-secondary)",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field title="Fonte">
              <select value={form.fonte} onChange={e => set("fonte", e.target.value)} style={input()}>
                {FONTES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field title="Borda">
              <select value={form.borda_estilo} onChange={e => set("borda_estilo", e.target.value as never)} style={input()}>
                {BORDAS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field title="Fundo do cabeçalho">
              <select value={form.fundo_cabecalho} onChange={e => set("fundo_cabecalho", e.target.value as never)} style={input()}>
                {FUNDOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </Field>
            <Field title="Orientação">
              <select value={form.orientacao} onChange={e => set("orientacao", e.target.value as never)} style={input()}>
                <option value="retrato">Retrato</option>
                <option value="paisagem">Paisagem</option>
              </select>
            </Field>
          </div>

          <Field title="Tamanho do papel">
            <select value={form.tamanho_papel} onChange={e => set("tamanho_papel", e.target.value as never)} style={{ ...input(), width: "auto" }}>
              <option value="A4">A4</option>
              <option value="Carta">Carta</option>
            </select>
          </Field>

          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={form.zebrado} onChange={e => set("zebrado", e.target.checked)} />
              Linhas zebradas
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={form.emoji_premios} onChange={e => set("emoji_premios", e.target.checked)} />
              Emojis nos prêmios
            </label>
          </div>
        </div>

        {error && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--blue)", color: "#fff", border: "none", cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Salvando..." : rifaInicial?.id ? "Salvar alterações" : "Criar rifa"}
        </button>
      </div>

      {/* ── PREVIEW ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", background: "#e8e8e8", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Preview — página 1 de {totalPaginas}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#666" }}>Zoom</span>
            {[0.38, 0.48, 0.60].map(s => (
              <button key={s} onClick={() => setPreviewEscala(s)} style={{
                padding: "3px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                background: previewEscala === s ? "#333" : "#fff",
                color: previewEscala === s ? "#fff" : "#333",
                border: "1px solid #ccc",
              }}>
                {Math.round(s * 100)}%
              </button>
            ))}
            {rifaInicial?.id && (
              <a href={`/rifas/${rifaInicial.id}/print`} target="_blank" style={{
                marginLeft: 8, padding: "4px 12px", borderRadius: 6, fontSize: 11,
                background: "#16a34a", color: "#fff", textDecoration: "none", fontWeight: 600,
              }}>
                🖨 Imprimir
              </a>
            )}
          </div>
        </div>

        {/* Moldura do preview */}
        <div style={{
          width: previewEscala * 794,
          height: previewEscala * 1123,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          borderRadius: 2,
          margin: "0 auto",
          position: "relative",
        }}>
          <div style={{ transform: `scale(${previewEscala})`, transformOrigin: "top left", width: `${100 / previewEscala}%` }}>
            <RifaPrintLayout
              rifa={form}
              organizacao={orgSelecionada}
              premios={premios}
              somentePagina={0}
            />
          </div>
        </div>
      </div>

      {/* ── MODAL NOVA ORGANIZAÇÃO ─────────────────────────── */}
      {showOrgModal && (
        <OrgModal
          onClose={() => setShowOrgModal(false)}
          onCreated={org => {
            setOrgs(prev => [...prev, org])
            set("organizacao_id", org.id)
            setShowOrgModal(false)
          }}
        />
      )}
    </div>
  )
}

function OrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (o: RifaOrganizacao) => void }) {
  const [nome, setNome] = useState("")
  const [subtitulo, setSubtitulo] = useState("")
  const [endereco, setEndereco] = useState("")
  const [cidade, setCidade] = useState("")
  const [telefone, setTelefone] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    if (!nome.trim()) { setError("Nome obrigatório"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/rifas/organizacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, subtitulo, endereco, cidade, telefone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onCreated(data)
    } catch (e) { setError(String(e)); setSaving(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Nova Organização</div>
        {[
          { label: "Nome *", value: nome, set: setNome, placeholder: "Nome da organização" },
          { label: "Subtítulo", value: subtitulo, set: setSubtitulo, placeholder: "Ex: OASE de Cruzeiro do Sul" },
          { label: "Endereço", value: endereco, set: setEndereco, placeholder: "Rua, número, bairro" },
          { label: "Cidade / CEP", value: cidade, set: setCidade, placeholder: "Ex: Cruzeiro do Sul - RS" },
          { label: "Telefone", value: telefone, set: setTelefone, placeholder: "Ex: Fone 784-1268" },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 3, fontWeight: 600 }}>{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              style={{ width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }} />
          </div>
        ))}
        {error && <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--blue)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}
