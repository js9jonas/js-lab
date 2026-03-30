"use client"

import { useState, useEffect, useCallback } from "react"
// ─── Tipos ────────────────────────────────────────────────────────────────────

type SimResult = {
  input: { text: string; messageType: string; fromMe: boolean }
  classification: { kind: string; confidence: string; meta: Record<string, unknown> }
  result: { success: boolean; action: string; detail?: string; error?: string }
  dryRun: boolean
}

type LogRow = {
  id: number
  received_at: string
  from_jid: string
  message_type: string
  kind: string
  confidence: string
  handler_action: string
  success: boolean
  detail?: string
}

type Tab = "simulador" | "logs" | "handlers"

// ─── Constantes ───────────────────────────────────────────────────────────────

const KIND_COLOR: Record<string, string> = {
  comprovante_pix: "#22c55e",
  comando:         "#3b82f6",
  texto_livre:     "#a78bfa",
  audio:           "#f59e0b",
  ignorar:         "#6b7280",
}

const CONF_COLOR: Record<string, string> = {
  alta:  "#22c55e",
  media: "#f59e0b",
  baixa: "#ef4444",
}

const EXAMPLES: Record<string, object> = {
  comprovante: {
    data: {
      key: { remoteJid: "5551999887766@s.whatsapp.net", fromMe: false, id: "TEST1" },
      message: { imageMessage: { caption: "Comprovante Pix R$ 45,00" } },
      messageType: "imageMessage",
      messageTimestamp: Date.now() / 1000,
    },
  },
  comando: {
    data: {
      key: { remoteJid: "5551999887766@s.whatsapp.net", fromMe: false, id: "TEST2" },
      message: { conversation: "/info" },
      messageType: "conversation",
      messageTimestamp: Date.now() / 1000,
    },
  },
  texto: {
    data: {
      key: { remoteJid: "5551999887766@s.whatsapp.net", fromMe: false, id: "TEST3" },
      message: { conversation: "Boa tarde! Preciso renovar minha assinatura." },
      messageType: "conversation",
      messageTimestamp: Date.now() / 1000,
    },
  },
  proprio: {
    data: {
      key: { remoteJid: "5551999887766@s.whatsapp.net", fromMe: true, id: "TEST4" },
      message: { conversation: "mensagem enviada por mim" },
      messageType: "conversation",
      messageTimestamp: Date.now() / 1000,
    },
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pill(color: string): React.CSSProperties {
  return { display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: color + "22", color }
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "7px 16px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    userSelect: "none",
    background: active ? "var(--bg-elevated)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
    border: active ? "1px solid var(--border-light)" : "1px solid transparent",
    transition: "all 0.12s",
    fontWeight: active ? 500 : 400,
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("simulador")
  const [payload, setPayload] = useState(JSON.stringify(EXAMPLES.comprovante, null, 2))
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch("/api/lab/logs?limit=50")
      const data: unknown = await res.json()
      if (Array.isArray(data)) setLogs(data as LogRow[])
    } catch { /* silencioso */ }
    finally { setLogsLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === "logs") loadLogs()
  }, [activeTab, loadLogs])

  async function runSim() {
    setSimLoading(true)
    setSimResult(null)
    try {
      const parsed: unknown = JSON.parse(payload)
      const res = await fetch("/api/lab/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: parsed, dryRun: true }),
      })
      setSimResult(await res.json() as SimResult)
    } catch (e) {
      setSimResult({
        input: { text: "", messageType: "", fromMe: false },
        classification: { kind: "erro", confidence: "alta", meta: {} },
        result: { success: false, action: "erro_payload", error: String(e) },
        dryRun: true,
      })
    } finally {
      setSimLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Topbar da página */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Simulador · Logs · Handlers</div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>
          webhook → <span style={{ color: "var(--text-secondary)" }}>/api/webhook</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "12px 28px", borderBottom: "1px solid var(--border)", display: "flex", gap: 6, background: "var(--bg-surface)" }}>
        {(["simulador", "logs", "handlers"] as Tab[]).map(t => (
          <div key={t} style={tabStyle(activeTab === t)} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>

        {/* ── Simulador ─────────────────────────────────────────────────── */}
        {activeTab === "simulador" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>EXEMPLOS RÁPIDOS</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.keys(EXAMPLES).map(k => (
                  <button key={k} onClick={() => setPayload(JSON.stringify(EXAMPLES[k], null, 2))}
                    style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 12 }}>PAYLOAD (messages.upsert)</div>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={11}
                style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--text-primary)", fontFamily: "var(--mono)", fontSize: 12, resize: "vertical" }}
              />
              <div style={{ marginTop: 12 }}>
                <button onClick={runSim} disabled={simLoading}
                  style={{ padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#2563eb", color: "#fff", border: "none" }}>
                  {simLoading ? "Testando..." : "▶ Testar (dry run)"}
                </button>
              </div>
            </div>

            {simResult && (
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 14 }}>RESULTADO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>TEXTO EXTRAÍDO</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{simResult.input.text || "(vazio)"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>CLASSIFICAÇÃO</div>
                    <span style={pill(KIND_COLOR[simResult.classification.kind] ?? "#888")}>{simResult.classification.kind}</span>{" "}
                    <span style={pill(CONF_COLOR[simResult.classification.confidence] ?? "#888")}>{simResult.classification.confidence}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>HANDLER</div>
                    <span style={pill(simResult.result.success ? "#22c55e" : "#ef4444")}>{simResult.result.action}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>JSON COMPLETO</div>
                <pre style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontSize: 11, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Logs ──────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div style={{ maxWidth: 960 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Últimas 50 mensagens do banco</div>
              <button onClick={loadLogs} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
                ↻ Atualizar
              </button>
            </div>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {logsLoading && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Carregando...</div>}
              {!logsLoading && logs.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Nenhum log ainda.</div>}
              {logs.map((log, i) => (
                <div key={log.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)", minWidth: 64, fontFamily: "var(--mono)" }}>
                    {new Date(log.received_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span style={pill(KIND_COLOR[log.kind] ?? "#888")}>{log.kind}</span>
                  <span style={pill(CONF_COLOR[log.confidence] ?? "#888")}>{log.confidence}</span>
                  <span style={{ color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.from_jid.replace("@s.whatsapp.net", "")} → {log.handler_action}
                    {log.detail && <span style={{ color: "var(--text-muted)" }}> · {log.detail}</span>}
                  </span>
                  <span style={pill(log.success ? "#22c55e" : "#ef4444")}>{log.success ? "ok" : "erro"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Handlers ──────────────────────────────────────────────────── */}
        {activeTab === "handlers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
            {([
              { kind: "comprovante_pix", file: "lib/handlers/comprovante-pix.ts", status: "ativo",    desc: "OCR + extração de valor + resposta automática" },
              { kind: "comando",         file: "lib/handlers/comando.ts",          status: "ativo",    desc: "/info, /status, /ajuda" },
              { kind: "audio",           file: "—",                                status: "pendente", desc: "Transcrição com Whisper (não implementado)" },
              { kind: "texto_livre",     file: "—",                                status: "pendente", desc: "Agente IA (não implementado)" },
            ] as const).map(h => (
              <div key={h.kind} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={pill(KIND_COLOR[h.kind] ?? "#888")}>{h.kind}</span>
                  <span style={pill(h.status === "ativo" ? "#22c55e" : "#f59e0b")}>{h.status}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)", marginLeft: "auto" }}>{h.file}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{h.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}