"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AgenteDetalhe {
  id: number; nome: string; descricao: string | null
  prompt_base: string; prompt_atual: string; ativo: boolean
  analisado_ate: string | null
  instancias: { instance: string; ativo: boolean }[]
  versoes: { versao: number; motivo: string | null; criado_em: string }[]
  aprendizados: {
    id: number; jid: string; sugestao_ia: string
    resposta_real: string; incorporado: boolean; criado_em: string
  }[]
}

interface Modulo {
  id: number; agente_id: number; nome: string; descricao: string | null
  gatilhos: string[]; conteudo: string; ordem: number; ativo: boolean
}

interface ModuloSugerido {
  nome: string; descricao: string | null; gatilhos: string[]; conteudo: string
}

interface ChatMsg { role: "user" | "assistant"; content: string }

type Tab = "refinamento" | "modulos" | "prompt" | "aprendizados" | "versoes" | "configuracao"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: color + "22", color, fontWeight: 600, border: `1px solid ${color}44` }}>
      {text}
    </span>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 10 }}>{children}</div>
}

// ─── Aba: Módulos ─────────────────────────────────────────────────────────────

function TabModulos({ agente, modulos, onRefresh }: {
  agente: AgenteDetalhe; modulos: Modulo[]; onRefresh: () => void
}) {
  const [editando, setEditando]   = useState<Modulo | null>(null)
  const [novo, setNovo]           = useState(false)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Módulos são blocos de conhecimento injetados no prompt quando os gatilhos são detectados na conversa.
        </div>
        <button onClick={() => setNovo(true)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap", marginLeft: 12 }}>
          + Novo módulo
        </button>
      </div>

      {(novo || editando) && (
        <ModuloForm
          agenteId={agente.id}
          modulo={editando ?? undefined}
          onSaved={() => { setNovo(false); setEditando(null); onRefresh() }}
          onCancel={() => { setNovo(false); setEditando(null) }}
        />
      )}

      {modulos.length === 0 && !novo && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>◇</div>
          Nenhum módulo criado.<br />
          Use o Chat de refinamento para que o agente sugira módulos, ou crie manualmente.
        </div>
      )}

      {modulos.map(m => (
        <ModuloCard key={m.id} modulo={m} onEdit={() => setEditando(m)} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

function ModuloCard({ modulo: m, onEdit, onRefresh }: { modulo: Modulo; onEdit: () => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)

  async function toggleAtivo() {
    await fetch(`/api/agentes/${m.agente_id}/modulos/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !m.ativo }),
    })
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Deletar módulo "${m.nome}"?`)) return
    await fetch(`/api/agentes/${m.agente_id}/modulos/${m.id}`, { method: "DELETE" })
    onRefresh()
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", opacity: m.ativo ? 1 : 0.6 }}>
      {/* Cabeçalho */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</span>
            <Badge color={m.ativo ? "#16a34a" : "#6b7280"} text={m.ativo ? "ativo" : "inativo"} />
            {m.ordem > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>ordem {m.ordem}</span>}
          </div>
          {m.descricao && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.descricao}</div>}
          {m.gatilhos.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {m.gatilhos.map(g => (
                <span key={g} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>{g}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button onClick={() => setExpanded(e => !e)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            {expanded ? "▲" : "▼"}
          </button>
          <button onClick={onEdit} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>Editar</button>
          <div onClick={toggleAtivo} style={{ width: 32, height: 18, borderRadius: 9, cursor: "pointer", background: m.ativo ? "#16a34a" : "var(--bg-elevated)", position: "relative", border: "1px solid var(--border)", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 1, left: m.ativo ? 14 : 1, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <button onClick={handleDelete} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "transparent", border: "1px solid var(--border)", color: "#dc2626", cursor: "pointer" }}>✕</button>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--bg-base)" }}>
          <pre style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, fontFamily: "inherit" }}>
            {m.conteudo || "(sem conteúdo)"}
          </pre>
        </div>
      )}
    </div>
  )
}

function ModuloForm({ agenteId, modulo, onSaved, onCancel }: {
  agenteId: number; modulo?: Modulo
  onSaved: () => void; onCancel: () => void
}) {
  const [nome, setNome]         = useState(modulo?.nome ?? "")
  const [descricao, setDescricao] = useState(modulo?.descricao ?? "")
  const [gatilhosStr, setGatilhosStr] = useState(modulo?.gatilhos.join(", ") ?? "")
  const [conteudo, setConteudo] = useState(modulo?.conteudo ?? "")
  const [ordem, setOrdem]       = useState(String(modulo?.ordem ?? 0))
  const [saving, setSaving]     = useState(false)

  async function handleSave() {
    setSaving(true)
    const gatilhos = gatilhosStr.split(",").map(g => g.trim()).filter(Boolean)
    const body = { nome, descricao, gatilhos, conteudo, ordem: Number(ordem) }

    if (modulo) {
      await fetch(`/api/agentes/${agenteId}/modulos/${modulo.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } else {
      await fetch(`/api/agentes/${agenteId}/modulos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", borderRadius: 10, padding: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>{modulo ? `Editar: ${modulo.nome}` : "Novo módulo"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Nome</div>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Licenças de aplicativo" style={{ width: "100%", padding: "8px 10px", fontSize: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Ordem</div>
            <input value={ordem} onChange={e => setOrdem(e.target.value)} type="number" style={{ width: 70, padding: "8px 10px", fontSize: 13 }} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Descrição (opcional)</div>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Para que serve este módulo?" style={{ width: "100%", padding: "8px 10px", fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Gatilhos (separados por vírgula)</div>
          <input value={gatilhosStr} onChange={e => setGatilhosStr(e.target.value)} placeholder="licença, aplicativo, app, cadastrar" style={{ width: "100%", padding: "8px 10px", fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Conteúdo do módulo</div>
          <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={8}
            style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "inherit", lineHeight: 1.7, resize: "vertical", boxSizing: "border-box" as const }}
            placeholder="Escreva as regras, procedimentos e informações que o agente deve usar quando este módulo for ativado..."
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nome.trim()} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" }}>
            {saving ? "Salvando..." : "Salvar módulo"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba: Prompt ──────────────────────────────────────────────────────────────

function TabPrompt({ agente, onSaved }: { agente: AgenteDetalhe; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(agente.prompt_atual)
  const [motivo, setMotivo] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const changed = prompt !== agente.prompt_atual

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/agentes/${agente.id}/prompt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, motivo }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    onSaved()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Prompt base — define identidade, tom e regras globais do agente. Os módulos são injetados automaticamente acima deste texto conforme os gatilhos detectados.
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={18}
        style={{ width: "100%", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7, resize: "vertical", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", boxSizing: "border-box" as const }}
      />
      {changed && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Motivo (opcional)</div>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Tom de voz ajustado" style={{ width: "100%", padding: "8px 12px" }} />
          </div>
          <button onClick={handleSave} disabled={saving} style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: saved ? "#16a34a" : "#2563eb", color: "#fff", border: "none", cursor: "pointer", transition: "background 0.3s" }}>
            {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar versão"}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Aba: Aprendizados ────────────────────────────────────────────────────────

function TabAprendizados({ agente }: { agente: AgenteDetalhe }) {
  const pendentes    = agente.aprendizados.filter(a => !a.incorporado)
  const incorporados = agente.aprendizados.filter(a => a.incorporado)

  if (agente.aprendizados.length === 0) return (
    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
      Nenhum aprendizado registrado ainda.
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pendentes.length > 0 && (
        <>
          <SectionLabel>{`PENDENTES — ${pendentes.length}`}</SectionLabel>
          {pendentes.map(a => <AprendizadoCard key={a.id} a={a} />)}
        </>
      )}
      {incorporados.length > 0 && (
        <div style={{ opacity: 0.6 }}>
          <SectionLabel>{`INCORPORADOS — ${incorporados.length}`}</SectionLabel>
          {incorporados.slice(0, 10).map(a => <AprendizadoCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}

function AprendizadoCard({ a }: { a: AgenteDetalhe["aprendizados"][0] }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
        {a.jid.replace("@s.whatsapp.net", "")} · {new Date(a.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#fef9c3", borderRadius: 6, padding: "8px 10px", border: "1px solid #fef08a" }}>
          <div style={{ fontSize: 9, color: "#92400e", fontWeight: 700, marginBottom: 4 }}>AGENTE SUGERIU</div>
          <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>{a.sugestao_ia}</div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 10px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 9, color: "#14532d", fontWeight: 700, marginBottom: 4 }}>VOCÊ ENVIOU</div>
          <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.5 }}>{a.resposta_real}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Aba: Versões ─────────────────────────────────────────────────────────────

function TabVersoes({ agente }: { agente: AgenteDetalhe }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {agente.versoes.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>Nenhuma versão salva ainda.</div>}
      {agente.versoes.map(v => (
        <div key={v.versao} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>v{v.versao}</span>
          {v.motivo && <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{v.motivo}</span>}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {new Date(v.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Aba: Chat de refinamento ─────────────────────────────────────────────────

function TabRefinamento({ agente, onPromptSalvo, onModuloSalvo }: {
  agente: AgenteDetalhe
  onPromptSalvo: () => void
  onModuloSalvo: () => void
}) {
  const [msgs, setMsgs]           = useState<ChatMsg[]>([])
  const [input, setInput]         = useState("")
  const [sending, setSending]     = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [promptSugerido, setPromptSugerido]     = useState<string | null>(null)
  const [modulosSugeridos, setModulosSugeridos] = useState<ModuloSugerido[]>([])
  const [salvando, setSalvando]   = useState(false)
  const [salvado, setSalvado]     = useState(false)
  const [analisadoAte, setAnalisadoAte] = useState<string | null>(agente.analisado_ate)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/agentes/${agente.id}/refinamento`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMsgs(d as ChatMsg[]) })
  }, [agente.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs.length])

  async function handleSend() {
    const txt = input.trim()
    if (!txt || sending) return
    setInput(""); setSending(true)
    setMsgs(prev => [...prev, { role: "user", content: txt }])
    const res = await fetch(`/api/agentes/${agente.id}/refinamento`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: txt }),
    })
    const data = await res.json() as {
      resposta?: string; promptSugerido?: string; modulosSugeridos?: ModuloSugerido[]
    }
    if (data.resposta)        setMsgs(prev => [...prev, { role: "assistant", content: data.resposta! }])
    if (data.promptSugerido)  setPromptSugerido(data.promptSugerido)
    if (data.modulosSugeridos?.length) setModulosSugeridos(data.modulosSugeridos)
    setSending(false)
  }

  async function handleSalvarPrompt() {
    if (!promptSugerido) return
    setSalvando(true)
    await fetch(`/api/agentes/${agente.id}/prompt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptSugerido, motivo: "Refinado via chat com IA" }),
    })
    setSalvando(false); setSalvado(true); setPromptSugerido(null)
    setTimeout(() => setSalvado(false), 3000)
    onPromptSalvo()
  }

  async function handleSalvarModulo(m: ModuloSugerido, idx: number) {
    await fetch(`/api/agentes/${agente.id}/modulos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    })
    setModulosSugeridos(prev => prev.filter((_, i) => i !== idx))
    onModuloSalvo()
  }

  async function handleLimpar() {
    await fetch(`/api/agentes/${agente.id}/refinamento`, { method: "DELETE" })
    setMsgs([]); setPromptSugerido(null); setModulosSugeridos([])
  }

  async function handleAnalisarPadroes() {
    setAnalisando(true)
    try {
      const res = await fetch(`/api/agentes/${agente.id}/analise-multi`, { method: "POST" })
      const data = await res.json() as {
        resposta?: string
        promptSugerido?: string
        modulosSugeridos?: ModuloSugerido[]
        conversas_analisadas?: number
        mensagens_analisadas?: number
        error?: string
      }
      if (data.error) {
        setMsgs(prev => [...prev, { role: "assistant", content: `Erro na análise: ${data.error}` }])
      } else if (data.resposta) {
        const header = data.conversas_analisadas
          ? `◈ Análise de padrões (${data.conversas_analisadas} conversas, ${data.mensagens_analisadas} mensagens)\n\n`
          : ""
        setMsgs(prev => [...prev, { role: "assistant", content: header + data.resposta }])
        if (data.promptSugerido)      setPromptSugerido(data.promptSugerido)
        if (data.modulosSugeridos?.length) setModulosSugeridos(data.modulosSugeridos)
        setAnalisadoAte(new Date().toISOString())
      }
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: "Erro ao conectar com a análise multi-conversa." }])
    } finally {
      setAnalisando(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Prompt sugerido */}
      {promptSugerido && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>◆ Prompt base atualizado sugerido</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPromptSugerido(null)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer" }}>Descartar</button>
              <button onClick={handleSalvarPrompt} disabled={salvando} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {salvando ? "..." : salvado ? "✓ Salvo!" : "✓ Aprovar"}
              </button>
            </div>
          </div>
          <pre style={{ fontSize: 11, color: "#166534", background: "#dcfce7", borderRadius: 6, padding: "10px 12px", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, maxHeight: 160, overflowY: "auto" }}>
            {promptSugerido}
          </pre>
        </div>
      )}

      {/* Módulos sugeridos */}
      {modulosSugeridos.map((m, idx) => (
        <div key={idx} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>◇ Módulo sugerido: {m.nome}</span>
              {m.descricao && <span style={{ fontSize: 11, color: "#6d28d9", marginLeft: 8 }}>{m.descricao}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModulosSugeridos(prev => prev.filter((_, i) => i !== idx))}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid #e9d5ff", color: "#7c3aed", cursor: "pointer" }}>Descartar</button>
              <button onClick={() => handleSalvarModulo(m, idx)}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>✓ Adicionar</button>
            </div>
          </div>
          {m.gatilhos.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
              {m.gatilhos.map(g => (
                <span key={g} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe" }}>{g}</span>
              ))}
            </div>
          )}
          <pre style={{ fontSize: 11, color: "#4c1d95", background: "#ede9fe", borderRadius: 6, padding: "10px 12px", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, maxHeight: 160, overflowY: "auto" }}>
            {m.conteudo}
          </pre>
        </div>
      ))}

      {/* Barra de ações */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button
          onClick={handleAnalisarPadroes}
          disabled={analisando || sending}
          title="Analisa padrões em múltiplas conversas recentes para sugerir melhorias"
          style={{
            fontSize: 11, padding: "5px 12px", borderRadius: 99,
            background: analisando ? "var(--bg-elevated)" : "#f0f9ff",
            border: "1px solid #bae6fd", color: analisando ? "var(--text-muted)" : "#0369a1",
            cursor: analisando ? "default" : "pointer", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 5,
          }}>
          {analisando ? "Analisando..." : "◈ Analisar padrões recentes"}
        </button>
        {analisadoAte && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            última análise: {new Date(analisadoAte).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {/* Mensagens */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 280, maxHeight: 460, overflowY: "auto", paddingRight: 4 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", fontSize: 13 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>◆</div>
            Converse com o agente sobre o prompt e os módulos.<br />
            Ele analisa tudo e pode sugerir melhorias, novos módulos ou reorganizações.
          </div>
        )}
        {msgs.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 2px 12px 12px" : "2px 12px 12px 12px", background: msg.role === "user" ? "#2563eb" : "var(--bg-elevated)", color: msg.role === "user" ? "#fff" : "var(--text-primary)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", border: msg.role === "assistant" ? "1px solid var(--border)" : "none" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: "2px 12px 12px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 13 }}>Analisando...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Converse com o agente sobre prompt e módulos... (Enter para enviar)"
          rows={2}
          style={{ flex: 1, resize: "none", padding: "9px 12px", fontSize: 13, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", outline: "none", lineHeight: 1.5 }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={handleSend} disabled={!input.trim() || sending}
            style={{ width: 40, height: 40, borderRadius: "50%", background: input.trim() ? "#2563eb" : "var(--bg-elevated)", border: "none", color: input.trim() ? "#fff" : "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
            ➤
          </button>
          {msgs.length > 0 && (
            <button onClick={handleLimpar} title="Limpar conversa"
              style={{ width: 40, height: 40, borderRadius: "50%", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Aba: Configuração ───────────────────────────────────────────────────────

function TabConfig({ agente, onSaved }: { agente: AgenteDetalhe; onSaved: () => void }) {
  const [nome, setNome]         = useState(agente.nome)
  const [descricao, setDescricao] = useState(agente.descricao ?? "")
  const [ativo, setAtivo]       = useState(agente.ativo)
  const [instancias, setInstancias] = useState<string[]>(
    agente.instancias.filter(i => i.ativo).map(i => i.instance)
  )
  const [instDisp, setInstDisp] = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch("/api/evolution/instance/fetchInstances")
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data))
          setInstDisp(data.map((i: Record<string, unknown>) => i.name as string).filter(Boolean))
      }).catch(() => {})
  }, [])

  function toggleInst(inst: string) {
    setInstancias(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst])
  }

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/agentes/${agente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, descricao, ativo, instancias }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    onSaved()
  }

  const changed =
    nome !== agente.nome ||
    descricao !== (agente.descricao ?? "") ||
    ativo !== agente.ativo ||
    JSON.stringify(instancias.sort()) !== JSON.stringify(agente.instancias.filter(i => i.ativo).map(i => i.instance).sort())

  // Instâncias que não estão na lista de disponíveis mas estão vinculadas
  const todasInst = Array.from(new Set([...instDisp, ...agente.instancias.map(i => i.instance)]))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 600 }}>

      {/* Nome e descrição */}
      <div>
        <SectionLabel>IDENTIFICAÇÃO</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Nome</div>
            <input value={nome} onChange={e => setNome(e.target.value)} style={{ width: "100%", padding: "9px 12px", fontSize: 14, fontWeight: 500 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Descrição</div>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Para que serve este agente?" style={{ width: "100%", padding: "9px 12px" }} />
          </div>
        </div>
      </div>

      {/* Instâncias */}
      <div>
        <SectionLabel>INSTÂNCIAS WHATSAPP VINCULADAS</SectionLabel>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Selecione quais instâncias este agente irá atender. Cada instância só pode ter um agente ativo.
          </div>
          {todasInst.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma instância disponível</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {todasInst.map(inst => {
                const sel = instancias.includes(inst)
                return (
                  <div key={inst} onClick={() => toggleInst(inst)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 13, fontWeight: sel ? 600 : 400, background: sel ? "#2563eb" : "var(--bg-surface)", color: sel ? "#fff" : "var(--text-secondary)", border: `1px solid ${sel ? "#2563eb" : "var(--border)"}`, transition: "all 0.15s" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sel ? "#fff" : "#22c55e", flexShrink: 0 }} />
                    {inst}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div>
        <SectionLabel>STATUS</SectionLabel>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Agente ativo</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {ativo ? "O agente está processando mensagens das instâncias vinculadas." : "O agente está pausado e não processará mensagens."}
            </div>
          </div>
          <div onClick={() => setAtivo(a => !a)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: ativo ? "#16a34a" : "var(--bg-elevated)", position: "relative", border: "1px solid var(--border)", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: ativo ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
      </div>

      {/* Salvar */}
      {changed && (
        <button onClick={handleSave} disabled={saving || !nome.trim()}
          style={{ padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: saved ? "#16a34a" : "#2563eb", color: "#fff", border: "none", cursor: "pointer", alignSelf: "flex-start", transition: "background 0.3s" }}>
          {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar configurações"}
        </button>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AgenteDetalhe() {
  const params    = useParams()
  const id        = params.id as string
  const [agente, setAgente]   = useState<AgenteDetalhe | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("refinamento")

  const loadAgente = useCallback(async () => {
    try {
      const [aRes, mRes] = await Promise.all([
        fetch(`/api/agentes/${id}`),
        fetch(`/api/agentes/${id}/modulos`),
      ])
      const [aData, mData] = await Promise.all([aRes.json(), mRes.json()])
      setAgente(aData as AgenteDetalhe)
      if (Array.isArray(mData)) setModulos(mData as Modulo[])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { loadAgente() }, [loadAgente])

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Carregando...</div>
  if (!agente) return <div style={{ padding: 40, color: "#dc2626", fontSize: 13, textAlign: "center" }}>Agente não encontrado.</div>

  const pendentes = agente.aprendizados.filter(a => !a.incorporado).length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "refinamento",  label: "Chat de refinamento" },
    { id: "modulos",      label: "Módulos", badge: modulos.length || undefined },
    { id: "prompt",       label: "Prompt base" },
    { id: "aprendizados", label: "Aprendizados", badge: pendentes || undefined },
    { id: "versoes",      label: "Versões" },
    { id: "configuracao", label: "Configuração" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Topbar */}
      <div style={{ padding: "14px 28px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <a href="/agentes" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Agentes</a>
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{agente.nome}</span>
          <Badge color={agente.ativo ? "#16a34a" : "#6b7280"} text={agente.ativo ? "ativo" : "inativo"} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {agente.instancias.filter(i => i.ativo).map(i => (
            <span key={i.instance} style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>{i.instance}</span>
          ))}
          {agente.descricao && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>{agente.descricao}</span>}
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{modulos.length} módulo{modulos.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", padding: "0 28px" }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", cursor: "pointer", fontSize: 13, color: activeTab === t.id ? "var(--text-primary)" : "var(--text-muted)", borderBottom: activeTab === t.id ? "2px solid #2563eb" : "2px solid transparent", transition: "all 0.12s", fontWeight: activeTab === t.id ? 500 : 400 }}>
            {t.label}
            {t.badge !== undefined && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: t.id === "modulos" ? "#ede9fe" : "#fef9c3", color: t.id === "modulos" ? "#7c3aed" : "#ca8a04", fontWeight: 600 }}>{t.badge}</span>
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {activeTab === "refinamento"  && <TabRefinamento  agente={agente} onPromptSalvo={loadAgente} onModuloSalvo={loadAgente} />}
        {activeTab === "modulos"      && <TabModulos      agente={agente} modulos={modulos} onRefresh={loadAgente} />}
        {activeTab === "prompt"       && <TabPrompt       agente={agente} onSaved={loadAgente} />}
        {activeTab === "aprendizados" && <TabAprendizados agente={agente} />}
        {activeTab === "versoes"      && <TabVersoes      agente={agente} />}
        {activeTab === "configuracao" && <TabConfig       agente={agente} onSaved={loadAgente} />}
      </div>
    </div>
  )
}
