"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LogRow {
  id: number
  received_at: string
  instance: string
  from_jid: string
  message_type: string
  kind: string
  confidence: string
  handler_action: string
  success: boolean
  detail?: string
  raw_payload?: unknown
}

interface SimResult {
  input: { text: string; messageType: string; fromMe: boolean }
  classification: { kind: string; confidence: string; meta: Record<string, unknown> }
  result: { success: boolean; action: string; detail?: string; error?: string }
  dryRun: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  comprovante_pix: "#22c55e",
  comando:         "#3b82f6",
  texto_livre:     "#a78bfa",
  audio:           "#f59e0b",
  ignorar:         "#6b7280",
  erro:            "#ef4444",
}

const CONF_COLOR: Record<string, string> = {
  alta:  "#22c55e",
  media: "#f59e0b",
  baixa: "#ef4444",
}

const MSG_ICON: Record<string, string> = {
  imageMessage:    "🖼",
  audioMessage:    "🎵",
  videoMessage:    "🎬",
  documentMessage: "📄",
  conversation:    "💬",
  stickerMessage:  "🪄",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pill(color: string): React.CSSProperties {
  return { display: "inline-block", padding: "2px 7px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: color + "22", color }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatJid(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", " (grupo)")
}

function extractCaption(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  const data = (raw as Record<string, unknown>).data as Record<string, unknown> | undefined
  if (!data) return ""
  const msg = data.message as Record<string, unknown> | undefined
  if (!msg) return ""
  return (msg.conversation as string) ?? ((msg.extendedTextMessage as Record<string, unknown>)?.text as string) ?? ((msg.imageMessage as Record<string, unknown>)?.caption as string) ?? ((msg.videoMessage as Record<string, unknown>)?.caption as string) ?? ""
}

// ─── Painel lateral de detalhe ────────────────────────────────────────────────

function DetailPanel({ log, onClose }: { log: LogRow; onClose: () => void }) {
  const [tab, setTab] = useState<"resumo" | "payload" | "simulacao">("resumo")
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  async function handleResimular() {
    if (!log.raw_payload) return
    setSimLoading(true); setSimResult(null); setTab("simulacao")
    try {
      const res = await fetch("/api/lab/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload: log.raw_payload, dryRun: true }) })
      setSimResult(await res.json() as SimResult)
    } catch (e) {
      setSimResult({ input: { text: "", messageType: "", fromMe: false }, classification: { kind: "erro", confidence: "alta", meta: {} }, result: { success: false, action: "erro", error: String(e) }, dryRun: true })
    } finally { setSimLoading(false) }
  }

  const caption = extractCaption(log.raw_payload)
  const kc = KIND_COLOR[log.kind] ?? "#888"

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", zIndex: 100, backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div style={{ width: 500, maxWidth: "95vw", height: "100vh", background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{MSG_ICON[log.message_type] ?? "📨"} {formatJid(log.from_jid)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{formatTime(log.received_at)} · {log.instance}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 18, padding: "4px 8px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {(["resumo", "payload", "simulacao"] as const).map(t => (
            <div key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "10px", textAlign: "center", cursor: "pointer", fontSize: 12, color: tab === t ? "var(--text-primary)" : "var(--text-muted)", borderBottom: tab === t ? "2px solid #3b82f6" : "2px solid transparent", transition: "all 0.12s" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {tab === "resumo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Section title="REMETENTE">
                <Field label="Número"   value={formatJid(log.from_jid)} mono />
                <Field label="Instância" value={log.instance} mono />
                <Field label="Tipo"     value={`${MSG_ICON[log.message_type] ?? "?"} ${log.message_type}`} />
                {caption && <Field label="Texto"   value={caption} />}
              </Section>

              <Section title="CLASSIFICAÇÃO">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={pill(kc)}>{log.kind}</span>
                  <span style={pill(CONF_COLOR[log.confidence] ?? "#888")}>{log.confidence}</span>
                  <span style={pill(log.success ? "#22c55e" : "#ef4444")}>{log.success ? "ok" : "erro"}</span>
                </div>
                <Field label="Handler" value={log.handler_action} mono />
                {log.detail && <Field label="Detalhe" value={log.detail} />}
              </Section>

              <button onClick={handleResimular} disabled={!log.raw_payload || simLoading}
                style={{ width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", border: "none", color: "#fff", opacity: log.raw_payload ? 1 : 0.4 }}>
                {simLoading ? "Simulando..." : "▶ Re-simular (dry run)"}
              </button>
              {!log.raw_payload && <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: -6 }}>Payload não disponível</div>}
            </div>
          )}

          {tab === "payload" && (
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 10 }}>RAW PAYLOAD</div>
              {log.raw_payload
                ? <pre style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, fontSize: 11, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{JSON.stringify(log.raw_payload, null, 2)}</pre>
                : <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Payload não disponível para este registro.</div>
              }
            </div>
          )}

          {tab === "simulacao" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!simResult && !simLoading && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Clique em "Re-simular" na aba Resumo.</div>}
              {simLoading && <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Simulando...</div>}
              {simResult && (
                <>
                  <Section title="RESULTADO DA SIMULAÇÃO">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={pill(KIND_COLOR[simResult.classification.kind] ?? "#888")}>{simResult.classification.kind}</span>
                      <span style={pill(CONF_COLOR[simResult.classification.confidence] ?? "#888")}>{simResult.classification.confidence}</span>
                      <span style={pill(simResult.result.success ? "#22c55e" : "#ef4444")}>{simResult.result.action}</span>
                    </div>
                    <Field label="Texto"  value={simResult.input.text || "(vazio)"} />
                    <Field label="Tipo"   value={simResult.input.messageType} />
                    {simResult.result.detail && <Field label="Detalhe" value={simResult.result.detail} />}
                    {simResult.result.error  && <Field label="Erro"    value={simResult.result.error} color="#ef4444" />}
                  </Section>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 8 }}>JSON COMPLETO</div>
                    <pre style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, fontSize: 11, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{JSON.stringify(simResult, null, 2)}</pre>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
    </div>
  )
}

function Field({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 80, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: color ?? "var(--text-secondary)", fontFamily: mono ? "var(--mono)" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MensagensPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [selected, setSelected] = useState<LogRow | null>(null)
  const [paused, setPaused] = useState(false)
  const [filterKind, setFilterKind] = useState("todos")
  const [lastId, setLastId] = useState(0)
  const [newCount, setNewCount] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Carga inicial com payload
  useEffect(() => {
    fetch("/api/lab/logs?limit=100&payload=1")
      .then(r => r.json())
      .then((rows: LogRow[]) => { if (Array.isArray(rows)) { setLogs(rows); if (rows.length > 0) setLastId(rows[0].id) } })
  }, [])

  // Polling 3s
  const fetchNew = useCallback(async () => {
    if (paused) return
    try {
      const rows: LogRow[] = await fetch("/api/lab/logs?limit=50&payload=1").then(r => r.json())
      if (!Array.isArray(rows)) return
      const novas = rows.filter(r => r.id > lastId)
      if (novas.length === 0) return
      setLogs(prev => { const ids = new Set(prev.map(r => r.id)); return [...novas.filter(r => !ids.has(r.id)), ...prev].slice(0, 200) })
      setLastId(novas[0].id)
      setNewCount(c => c + novas.length)
    } catch { /* silencioso */ }
  }, [paused, lastId])

  useEffect(() => { const t = setInterval(fetchNew, 3000); return () => clearInterval(t) }, [fetchNew])

  const kinds   = ["todos", ...Array.from(new Set(logs.map(l => l.kind)))]
  const filtered = filterKind === "todos" ? logs : logs.filter(l => l.kind === filterKind)

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {selected && <DetailPanel log={selected} onClose={() => setSelected(null)} />}

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Mensagens</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {filtered.length} mensagens · polling 3s
            {newCount > 0 && <span style={{ color: "#22c55e", marginLeft: 8 }}>+{newCount} novas</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterKind} onChange={e => setFilterKind(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 12, borderRadius: 8 }}>
            {kinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button onClick={() => { setPaused(p => !p); setNewCount(0) }}
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: paused ? "#22c55e22" : "var(--bg-elevated)", color: paused ? "#22c55e" : "var(--text-secondary)", border: `1px solid ${paused ? "#22c55e44" : "var(--border-light)"}` }}>
            {paused ? "▶ Retomar" : "⏸ Pausar"}
          </button>
          <button onClick={() => { setLogs([]); setNewCount(0) }}
            style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
            Limpar
          </button>
        </div>
      </div>

      {/* Legenda de tipos */}
      <div style={{ padding: "8px 28px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap", background: "var(--bg-surface)" }}>
        {Object.entries(KIND_COLOR).map(([k, c]) => (
          <span key={k} onClick={() => setFilterKind(k === filterKind ? "todos" : k)} style={{ ...pill(c), cursor: "pointer", opacity: filterKind !== "todos" && filterKind !== k ? 0.3 : 1, transition: "opacity 0.12s" }}>{k}</span>
        ))}
      </div>

      {/* Feed */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto" }}>
        {logs.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, marginBottom: 6, color: "var(--text-secondary)" }}>Nenhuma mensagem ainda</div>
            <div style={{ fontSize: 12 }}>Configure o webhook da instância para apontar para <code style={{ color: "var(--text-secondary)", fontFamily: "var(--mono)" }}>/api/webhook</code></div>
          </div>
        )}

        {filtered.map((log, idx) => {
          const kc     = KIND_COLOR[log.kind] ?? "#888"
          const isNew  = idx < newCount && !paused
          const caption = extractCaption(log.raw_payload)

          return (
            <div key={log.id} onClick={() => setSelected(log)}
              style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 28px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isNew ? "#f0fdf4" : "transparent", transition: "background 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isNew ? "#f0fdf4" : "transparent" }}
            >
              {/* Ícone */}
              <div style={{ width: 34, height: 34, borderRadius: 8, background: kc + "18", border: `1px solid ${kc}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                {MSG_ICON[log.message_type] ?? "📨"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{formatJid(log.from_jid)}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.instance}</span>
                  {isNew && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "#22c55e33", color: "#22c55e", fontWeight: 700 }}>NOVO</span>}
                </div>
                {caption && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420, marginBottom: 5 }}>{caption}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={pill(kc)}>{log.kind}</span>
                  <span style={pill(CONF_COLOR[log.confidence] ?? "#888")}>{log.confidence}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{log.handler_action}</span>
                </div>
              </div>

              {/* Hora + status */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{formatTime(log.received_at)}</span>
                <span style={pill(log.success ? "#22c55e" : "#ef4444")}>{log.success ? "ok" : "erro"}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}