"use client"

import { useState, useEffect, useCallback } from "react"

interface Comando {
  id: number
  trigger: string
  descricao: string
  resposta: string
  ativo: boolean
  criado_em: string
  atualizado_em: string
}

// ─── Modal de edição ──────────────────────────────────────────────────────────

function EditModal({ cmd, onClose, onSaved }: { cmd: Comando; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState(cmd.descricao)
  const [resposta, setResposta]   = useState(cmd.resposta)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  async function handleSave() {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/comandos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, descricao, resposta }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) { onSaved(); onClose() }
      else setError(data.error ?? "Erro ao salvar")
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 540, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Editar comando</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, fontFamily: "var(--mono)" }}>{cmd.trigger}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Descrição">
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Para que serve este comando?"
              style={{ width: "100%", padding: "9px 12px" }}
            />
          </Field>

          <Field label="Resposta enviada ao cliente">
            <textarea
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              rows={7}
              placeholder="Texto que será enviado via WhatsApp..."
              style={{ width: "100%", padding: "9px 12px", resize: "vertical", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Suporta formatação WhatsApp: *negrito*, _itálico_, ~riscado~
            </div>
          </Field>
        </div>

        {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de novo comando ────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [trigger, setTrigger]     = useState("/")
  const [descricao, setDescricao] = useState("")
  const [resposta, setResposta]   = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  async function handleCreate() {
    if (!trigger.trim() || trigger === "/") { setError("Trigger obrigatório"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/comandos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger, descricao, resposta }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (data.ok) { onCreated(); onClose() }
      else setError(data.error ?? "Erro ao criar")
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: 540, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20 }}>Novo comando</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Trigger">
            <input
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              placeholder="/meucomando"
              style={{ width: "100%", padding: "9px 12px", fontFamily: "var(--mono)" }}
            />
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Prefixo / ou # ou ! seguido do nome (ex: /renovar)
            </div>
          </Field>

          <Field label="Descrição">
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Para que serve este comando?"
              style={{ width: "100%", padding: "9px 12px" }}
            />
          </Field>

          <Field label="Resposta enviada ao cliente">
            <textarea
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              rows={6}
              placeholder="Texto que será enviado via WhatsApp..."
              style={{ width: "100%", padding: "9px 12px", resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
            />
          </Field>
        </div>

        {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={loading} style={{ flex: 1, padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
            {loading ? "Criando..." : "Criar comando"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de comando ──────────────────────────────────────────────────────────

function ComandoCard({ cmd, onRefresh }: { cmd: Comando; onRefresh: () => void }) {
  const [editing, setEditing]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const prefixColor =
    cmd.trigger.startsWith("/") ? "#2563eb" :
    cmd.trigger.startsWith("#") ? "#7c3aed" : "#0d9488"

  const prefixBg =
    cmd.trigger.startsWith("/") ? "#eff6ff" :
    cmd.trigger.startsWith("#") ? "#f5f3ff" : "#f0fdfa"

  const prefixBorder =
    cmd.trigger.startsWith("/") ? "#bfdbfe" :
    cmd.trigger.startsWith("#") ? "#ddd6fe" : "#99f6e4"

  async function toggleAtivo() {
    await fetch("/api/comandos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cmd.id, ativo: !cmd.ativo }),
    })
    onRefresh()
  }

  async function handleDelete() {
    if (!deleting) { setDeleting(true); return }
    await fetch(`/api/comandos?id=${cmd.id}`, { method: "DELETE" })
    onRefresh()
  }

  return (
    <>
      {editing && <EditModal cmd={cmd} onClose={() => setEditing(false)} onSaved={onRefresh} />}

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12, opacity: cmd.ativo ? 1 : 0.55, transition: "opacity 0.2s" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: prefixBg, color: prefixColor, border: `1px solid ${prefixBorder}`, fontFamily: "var(--mono)" }}>
              {cmd.trigger}
            </span>
            {!cmd.ativo && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", fontWeight: 600 }}>
                inativo
              </span>
            )}
          </div>
          <div onClick={toggleAtivo} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: cmd.ativo ? "#16a34a" : "var(--bg-elevated)", position: "relative", transition: "background 0.2s", border: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: cmd.ativo ? 17 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
          </div>
        </div>

        {/* Descrição */}
        {cmd.descricao && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{cmd.descricao}</div>
        )}

        {/* Preview da resposta */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 100, overflow: "hidden", position: "relative" }}>
          {cmd.resposta || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>sem resposta configurada</span>}
          {cmd.resposta.length > 200 && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 32, background: "linear-gradient(transparent, var(--bg-elevated))" }} />
          )}
        </div>

        {/* Rodapé */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Atualizado {new Date(cmd.atualizado_em).toLocaleDateString("pt-BR")}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setDeleting(false); handleDelete() }}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: `1px solid ${deleting ? "#fecaca" : "var(--border)"}`, background: deleting ? "#fee2e2" : "transparent", color: deleting ? "#dc2626" : "var(--text-muted)", cursor: "pointer" }}
            >
              {deleting ? "Confirmar exclusão" : "Excluir"}
            </button>
            <button
              onClick={() => setEditing(true)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontWeight: 500 }}
            >
              Editar →
            </button>
          </div>
        </div>
      </div>
    </>
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

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ComandosPage() {
  const [comandos, setComandos]     = useState<Comando[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/comandos")
      const data: unknown = await res.json()
      if (Array.isArray(data)) setComandos(data as Comando[])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const ativos   = comandos.filter(c => c.ativo)
  const inativos = comandos.filter(c => !c.ativo)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Comandos WhatsApp</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {ativos.length} ativo{ativos.length !== 1 ? "s" : ""} · {inativos.length} inativo{inativos.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
          + Novo comando
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>Carregando...</div>}

        {!loading && comandos.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Nenhum comando cadastrado</div>
            <button onClick={() => setShowCreate(true)} style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", marginTop: 8 }}>
              + Novo comando
            </button>
          </div>
        )}

        {ativos.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>ATIVOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {ativos.map(c => <ComandoCard key={c.id} cmd={c} onRefresh={load} />)}
            </div>
          </div>
        )}

        {inativos.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>INATIVOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {inativos.map(c => <ComandoCard key={c.id} cmd={c} onRefresh={load} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
