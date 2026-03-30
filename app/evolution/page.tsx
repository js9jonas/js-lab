"use client"

import { useState, useEffect, useCallback } from "react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Instance {
  id?: string
  name?: string
  connectionStatus?: string
  profileName?: string
  profilePicUrl?: string
  _count?: { Message?: number; Contact?: number; Chat?: number }
}

interface WebhookConfig {
  url: string
  enabled: boolean
  events: string[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATE: Record<string, { label: string; color: string }> = {
  open:       { label: "Conectado",    color: "#22c55e" },
  connecting: { label: "Conectando",   color: "#f59e0b" },
  close:      { label: "Desconectado", color: "#ef4444" },
  default:    { label: "Desconhecido", color: "#6b7280" },
}

const EVENTS_CONFIG = [
  { key: "MESSAGES_UPSERT",   label: "messages.upsert",   desc: "Mensagens recebidas/enviadas",  rec: true  },
  { key: "MESSAGES_UPDATE",   label: "messages.update",   desc: "Atualizações (lido, entregue)", rec: false },
  { key: "CONNECTION_UPDATE", label: "connection.update", desc: "Conexão/desconexão",            rec: true  },
  { key: "SEND_MESSAGE",      label: "send.message",      desc: "Confirmação de envio",          rec: false },
  { key: "CONTACTS_UPSERT",  label: "contacts.upsert",   desc: "Novos contatos",                rec: false },
  { key: "CHATS_UPSERT",     label: "chats.upsert",      desc: "Novos chats",                   rec: false },
]

const api = async (path: string, options: RequestInit = {}) =>
  fetch(`/api/evolution${path}`, { headers: { "Content-Type": "application/json" }, ...options }).then(r => r.json())

// ─── Modal QR ─────────────────────────────────────────────────────────────────

function QRModal({ instance, onClose }: { instance: string; onClose: (ok: boolean) => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dots, setDots] = useState("")

  useEffect(() => { api(`/instance/connect/${instance}`).then(d => { setQr(d.base64 ?? null); setLoading(false) }) }, [instance])
  useEffect(() => { const t = setInterval(async () => { const d = await api(`/instance/connectionState/${instance}`); if (d?.instance?.state === "open" || d?.state === "open") onClose(true) }, 3000); return () => clearInterval(t) }, [instance, onClose])
  useEffect(() => { const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500); return () => clearInterval(t) }, [])

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(6px)" }} onClick={() => onClose(false)}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 16, padding: 32, textAlign: "center", width: 320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, color: "#22c55e", letterSpacing: 2, fontFamily: "var(--mono)", marginBottom: 6 }}>ESCANEIE O QR CODE</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24 }}>instância: <span style={{ color: "var(--text-secondary)" }}>{instance}</span></div>
        {loading && <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Carregando{dots}</div>}
        {!loading && qr && <><img src={qr} alt="QR" style={{ width: 260, height: 260, borderRadius: 8, display: "block", margin: "0 auto" }} /><div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>Aguardando leitura{dots}</div></>}
        {!loading && !qr && <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: 13 }}>Não foi possível carregar o QR.</div>}
        <button onClick={() => onClose(false)} style={{ marginTop: 20, width: "100%", background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-muted)", borderRadius: 8, padding: "8px", fontSize: 12 }}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Modal criar instância ─────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCreate() {
    const n = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
    if (!n) { setError("Nome inválido."); return }
    setLoading(true); setError("")
    try {
      const res = await api("/instance/create", { method: "POST", body: JSON.stringify({ instanceName: n, integration: "WHATSAPP-BAILEYS" }) })
      console.log("[create]", res)
      const criou = res?.instance?.instanceName ?? res?.instance?.name ?? res?.instanceName ?? res?.name
      if (criou) { onCreated(); onClose() }
      else setError(String(res?.message ?? res?.error ?? JSON.stringify(res)))
    } catch (e) { setError("Fetch falhou: " + String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 16, padding: 28, width: 340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Nova instância</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Letras minúsculas, números, hífens e underlines.</div>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="ex: minha-instancia" style={{ width: "100%", padding: "10px 12px", fontSize: 14 }} />
        {error && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-muted)", borderRadius: 8, padding: "9px", fontSize: 13 }}>Cancelar</button>
          <button onClick={handleCreate} disabled={loading} style={{ flex: 1, background: "#2563eb", border: "none", color: "#fff", borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600 }}>{loading ? "Criando..." : "Criar"}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Seção Webhook ─────────────────────────────────────────────────────────────

function WebhookSection({ instanceName }: { instanceName: string }) {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<WebhookConfig | null>(null)
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const defaultUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhook` : "/api/webhook"

  useEffect(() => {
    if (!open || config !== null) return
    setLoadingFetch(true)
    api(`/webhook/find/${instanceName}`)
      .then(d => { const wh = d?.webhook ?? d; setConfig({ url: wh?.url ?? "", enabled: wh?.enabled ?? false, events: wh?.events ?? [] }) })
      .catch(() => setConfig({ url: "", enabled: false, events: [] }))
      .finally(() => setLoadingFetch(false))
  }, [open, instanceName, config])

  function toggleEvent(key: string) {
    if (!config) return
    setConfig({ ...config, events: config.events.includes(key) ? config.events.filter(e => e !== key) : [...config.events, key] })
  }

  async function handleSave() {
    if (!config) return
    setSaving(true); setError(""); setSaved(false)
    try {
      await api(`/webhook/set/${instanceName}`, { method: "POST", body: JSON.stringify({ url: config.url, enabled: config.enabled, events: config.events, webhookByEvents: false, webhookBase64: false }) })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError("Erro ao salvar: " + String(e)) }
    finally { setSaving(false) }
  }

  const webhookAtivo = config?.enabled && !!config?.url

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Webhook</span>
          {config && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: webhookAtivo ? "#22c55e22" : "#ef444422", color: webhookAtivo ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
              {webhookAtivo ? "ativo" : "inativo"}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {loadingFetch && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Carregando...</div>}
          {config && !loadingFetch && (
            <>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>URL</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} placeholder="https://..." style={{ flex: 1, padding: "7px 10px", fontSize: 12, minWidth: 0 }} />
                  <button onClick={() => setConfig({ ...config, url: defaultUrl })} title="Usar URL do js-lab" style={{ padding: "7px 10px", borderRadius: 8, fontSize: 11, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>↙ js-lab</button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Habilitado</span>
                <div onClick={() => setConfig({ ...config, enabled: !config.enabled })} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", background: config.enabled ? "#16a34a" : "var(--bg-elevated)", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ position: "absolute", top: 2, left: config.enabled ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Eventos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {EVENTS_CONFIG.map(ev => (
                    <div key={ev.key} onClick={() => toggleEvent(ev.key)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: config.events.includes(ev.key) ? "#1a1d2e" : "transparent", border: `1px solid ${config.events.includes(ev.key) ? "#3b82f633" : "var(--border)"}`, transition: "all 0.12s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${config.events.includes(ev.key) ? "#3b82f6" : "var(--border-light)"}`, background: config.events.includes(ev.key) ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>
                        {config.events.includes(ev.key) && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: config.events.includes(ev.key) ? "#93c5fd" : "var(--text-muted)" }}>{ev.label}</div>
                        <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 1 }}>{ev.desc}</div>
                      </div>
                      {ev.rec && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "#f59e0b22", color: "#f59e0b", flexShrink: 0 }}>rec.</span>}
                    </div>
                  ))}
                </div>
              </div>

              {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: saved ? "#16a34a" : "#2563eb", border: "none", color: "#fff", transition: "background 0.3s" }}>
                {saving ? "Salvando..." : saved ? "✓ Salvo!" : "Salvar configuração"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card de instância ────────────────────────────────────────────────────────

function InstanceCard({ inst, onRefresh }: { inst: Instance; onRefresh: () => void }) {
  const [showQR, setShowQR] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const name   = inst.name ?? "?"
  const status = inst.connectionStatus ?? "default"
  const cfg    = STATE[status] ?? STATE.default

  async function handleLogout() { setLoading(true); await api(`/instance/logout/${name}`, { method: "DELETE" }); await onRefresh(); setLoading(false) }
  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setLoading(true); await api(`/instance/delete/${name}`, { method: "DELETE" }); await onRefresh(); setLoading(false)
  }

  return (
    <>
      {showQR && <QRModal instance={name} onClose={ok => { setShowQR(false); if (ok) onRefresh() }} />}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Avatar + nome */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {inst.profilePicUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={inst.profilePicUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-light)" }} />
            : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--bg-elevated)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--text-muted)" }}>◉</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.profileName ?? name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{name}</div>
          </div>
        </div>

        {/* Contadores */}
        {inst._count && (
          <div style={{ display: "flex", gap: 0, background: "var(--bg-elevated)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {([["Message", "Msgs"], ["Contact", "Contatos"], ["Chat", "Chats"]] as const).map(([k, l], i) =>
              inst._count![k] !== undefined ? (
                <div key={k} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{(inst._count![k] ?? 0).toLocaleString("pt-BR")}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>{l}</div>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: cfg.color + "12", border: `1px solid ${cfg.color}33`, borderRadius: 8, padding: "8px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, boxShadow: status === "open" ? `0 0 6px ${cfg.color}` : "none" }} />
            <span style={{ fontSize: 12, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
          </div>
          <span style={{ fontSize: 11, color: cfg.color, fontFamily: "var(--mono)", opacity: 0.7 }}>{status}</span>
        </div>

        {/* Ações */}
        <div style={{ display: "flex", gap: 8 }}>
          {status !== "open" && (
            <button onClick={() => setShowQR(true)} disabled={loading} style={{ flex: 1, background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600 }}>Conectar QR</button>
          )}
          {status === "open" && (
            <button onClick={handleLogout} disabled={loading} style={{ flex: 1, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-secondary)", borderRadius: 8, padding: "8px", fontSize: 12 }}>Desconectar</button>
          )}
          <button onClick={handleDelete} disabled={loading} onMouseLeave={() => setConfirmDelete(false)}
            style={{ flex: confirmDelete ? 2 : 1, background: confirmDelete ? "#7f1d1d" : "transparent", border: `1px solid ${confirmDelete ? "#ef4444" : "var(--border-light)"}`, color: confirmDelete ? "#fca5a5" : "var(--text-muted)", borderRadius: 8, padding: "8px", fontSize: 12, transition: "all 0.2s" }}>
            {confirmDelete ? "Confirmar exclusão" : "Deletar"}
          </button>
        </div>

        <WebhookSection instanceName={name} />
      </div>
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EvolutionPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState("")

  const fetchInstances = useCallback(async () => {
    try {
      const data = await api("/instance/fetchInstances")
      if (Array.isArray(data)) { setInstances(data); setError("") }
      else setError("Não foi possível carregar as instâncias.")
      setLastUpdate(new Date())
    } catch { setError("Erro de conexão com a Evolution API.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInstances(); const t = setInterval(fetchInstances, 15000); return () => clearInterval(t) }, [fetchInstances])

  const connected = instances.filter(i => i.connectionStatus === "open").length

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchInstances} />}

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Instâncias</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {lastUpdate ? `Atualizado ${lastUpdate.toLocaleTimeString("pt-BR")}` : "Carregando..."}
            {" · "}auto-refresh 15s
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <span style={{ color: connected > 0 ? "#22c55e" : "var(--text-muted)", fontWeight: 600 }}>{connected}</span>/{instances.length} conectada{connected !== 1 ? "s" : ""}
          </div>
          <button onClick={fetchInstances} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>↻</button>
          <button onClick={() => setShowCreate(true)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none" }}>+ Nova instância</button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {error && <div style={{ background: "#1c020222", border: "1px solid #ef444433", borderRadius: 10, padding: "12px 16px", color: "#f87171", fontSize: 13, marginBottom: 20 }}>{error}</div>}
        {loading && !error && <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 40, textAlign: "center" }}>Carregando instâncias...</div>}
        {!loading && !error && instances.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◉</div>
            <div style={{ fontSize: 14, marginBottom: 6, color: "var(--text-secondary)" }}>Nenhuma instância criada</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>Crie uma instância para conectar um número de WhatsApp.</div>
            <button onClick={() => setShowCreate(true)} style={{ background: "#2563eb", border: "none", color: "#fff", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 600 }}>+ Nova instância</button>
          </div>
        )}
        {!loading && instances.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {instances.map((inst, i) => <InstanceCard key={inst.id ?? inst.name ?? i} inst={inst} onRefresh={fetchInstances} />)}
          </div>
        )}
      </div>
    </div>
  )
}
