"use client"

import { useState, useEffect, useCallback } from "react"

interface Agente {
  id: number
  nome: string
  descricao: string | null
  prompt_atual: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
  instancias: string[]
  aprendizados_pendentes: number
}

// ─── Modal de criar agente ────────────────────────────────────────────────────

function CreateModal({ instanciasDisponiveis, onClose, onCreated }: {
  instanciasDisponiveis: string[]
  onClose: () => void
  onCreated: () => void
}) {
  const [nome, setNome]               = useState("")
  const [descricao, setDescricao]     = useState("")
  const [prompt, setPrompt]           = useState("")
  const [instancias, setInstancias]   = useState<string[]>([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState("")

  function toggleInst(inst: string) {
    setInstancias(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst])
  }

  async function handleCreate() {
    if (!nome.trim()) { setError("Nome obrigatório."); return }
    if (!prompt.trim()) { setError("Prompt obrigatório."); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, descricao, prompt_base: prompt, instancias }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) { onCreated(); onClose() }
      else setError(data.error ?? "Erro ao criar")
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Novo agente</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Nome">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Atendimento IPTV" style={{ width: "100%", padding: "9px 12px" }} />
          </Field>

          <Field label="Descrição (opcional)">
            <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Para que serve este agente?" style={{ width: "100%", padding: "9px 12px" }} />
          </Field>

          <Field label="Prompt inicial">
            <textarea
              value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Você é um assistente de atendimento da JS Sistemas..."
              rows={6}
              style={{ width: "100%", padding: "9px 12px", resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
            />
          </Field>

          <Field label="Instâncias WhatsApp">
            {instanciasDisponiveis.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma instância disponível</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {instanciasDisponiveis.map(inst => (
                  <div
                    key={inst}
                    onClick={() => toggleInst(inst)}
                    style={{
                      padding: "5px 12px", borderRadius: 99, fontSize: 12, cursor: "pointer",
                      background: instancias.includes(inst) ? "#2563eb" : "var(--bg-elevated)",
                      color: instancias.includes(inst) ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${instancias.includes(inst) ? "#2563eb" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    {inst}
                  </div>
                ))}
              </div>
            )}
          </Field>
        </div>

        {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>Cancelar</button>
          <button onClick={handleCreate} disabled={loading} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
            {loading ? "Criando..." : "Criar agente"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

// ─── Card de agente ───────────────────────────────────────────────────────────

function AgenteCard({ agente, onRefresh }: { agente: Agente; onRefresh: () => void }) {
  async function toggleAtivo() {
    await fetch(`/api/agentes/${agente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !agente.ativo }),
    })
    onRefresh()
  }

  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12, opacity: agente.ativo ? 1 : 0.6 }}>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{agente.nome}</div>
          {agente.descricao && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{agente.descricao}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {agente.aprendizados_pendentes > 0 && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#fef9c3", color: "#ca8a04", fontWeight: 600, border: "1px solid #fef08a" }}>
              {agente.aprendizados_pendentes} aprendizados
            </span>
          )}
          <div onClick={toggleAtivo} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: agente.ativo ? "#16a34a" : "var(--bg-elevated)", position: "relative", transition: "background 0.2s", border: "1px solid var(--border)" }}>
            <div style={{ position: "absolute", top: 2, left: agente.ativo ? 17 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
          </div>
        </div>
      </div>

      {/* Instâncias */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {agente.instancias.length === 0 ? (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sem instâncias vinculadas</span>
        ) : agente.instancias.map(inst => (
          <span key={inst} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", fontWeight: 500 }}>
            {inst}
          </span>
        ))}
      </div>

      {/* Preview do prompt */}
      {agente.prompt_atual && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-elevated)", borderRadius: 6, padding: "8px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {agente.prompt_atual.slice(0, 120)}{agente.prompt_atual.length > 120 ? "..." : ""}
        </div>
      )}

      {/* Rodapé */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Atualizado {new Date(agente.atualizado_em).toLocaleDateString("pt-BR")}
        </div>
        <a href={`/agentes/${agente.id}`} style={{ fontSize: 12, color: "#2563eb", fontWeight: 500, textDecoration: "none", padding: "5px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff" }}>
          Gerenciar →
        </a>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AgentesPage() {
  const [agentes, setAgentes]         = useState<Agente[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)

  // Instâncias disponíveis (busca na Evolution via proxy)
  const [instanciasDisponiveis, setInstanciasDisponiveis] = useState<string[]>([])

  const loadAgentes = useCallback(async () => {
    try {
      const res = await fetch("/api/agentes")
      const data: unknown = await res.json()
      if (Array.isArray(data)) setAgentes(data as Agente[])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadAgentes()
    // Busca instâncias disponíveis
    fetch("/api/evolution/instance/fetchInstances")
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data))
          setInstanciasDisponiveis(data.map((i: Record<string, unknown>) => i.name as string).filter(Boolean))
      }).catch(() => {})
  }, [loadAgentes])

  const ativos   = agentes.filter(a => a.ativo)
  const inativos = agentes.filter(a => !a.ativo)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {showCreate && (
        <CreateModal
          instanciasDisponiveis={instanciasDisponiveis}
          onClose={() => setShowCreate(false)}
          onCreated={loadAgentes}
        />
      )}

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Agentes IA</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""} · {agentes.reduce((s, a) => s + a.aprendizados_pendentes, 0)} aprendizados pendentes
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
          + Novo agente
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>Carregando...</div>}

        {!loading && agentes.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◆</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Nenhum agente cadastrado</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Crie um agente para começar a usar o modo sombra.</div>
            <button onClick={() => setShowCreate(true)} style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
              + Novo agente
            </button>
          </div>
        )}

        {ativos.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>ATIVOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {ativos.map(a => <AgenteCard key={a.id} agente={a} onRefresh={loadAgentes} />)}
            </div>
          </div>
        )}

        {inativos.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>INATIVOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {inativos.map(a => <AgenteCard key={a.id} agente={a} onRefresh={loadAgentes} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
