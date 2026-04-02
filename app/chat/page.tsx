"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { ContactInfo } from "@/app/api/chat/contact/route"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Conversation {
  jid: string
  instance: string
  profile_name: string | null
  profile_pic_url: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  is_client: boolean | null
  shadow_mode: boolean
  muted: boolean
}

interface Message {
  id: string
  jid: string
  from_me: boolean
  message_type: string
  content: string | null
  media_url: string | null
  status: string | null
  timestamp: string
  raw?: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJid(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function statusColor(status: string) {
  const s = status?.toLowerCase()
  if (s === "ativo" || s === "ativa") return { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" }
  if (s === "inativo" || s === "inativa" || s === "cancelado") return { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" }
  if (s === "pendente") return { bg: "#fef9c3", color: "#ca8a04", border: "#fef08a" }
  return { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" }
}

function scoreColor(score: number) {
  if (score >= 80) return "#16a34a"
  if (score >= 50) return "#d97706"
  return "#dc2626"
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, pic, size = 40 }: { name?: string | null; pic?: string | null; size?: number }) {
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"
  if (pic) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pic} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--border)" }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, color: "#64748b", flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ─── Item da lista ────────────────────────────────────────────────────────────

function ConversationItem({ conv, active, onClick }: { conv: Conversation; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: active ? "#e8f5e9" : "transparent", borderBottom: "1px solid var(--border)", transition: "background 0.12s" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent" }}
    >
      <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={conv.profile_pic_url} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontWeight: conv.unread_count > 0 ? 600 : 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
            {conv.profile_name ?? formatJid(conv.jid)}
          </span>
          <span style={{ fontSize: 10, color: conv.unread_count > 0 ? "#16a34a" : "var(--text-muted)", flexShrink: 0 }}>
            {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
            {conv.last_message ?? "Sem mensagens"}
          </span>
          {conv.unread_count > 0 && (
            <span style={{ background: "#16a34a", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px", flexShrink: 0, marginLeft: 4 }}>
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Balão de mensagem ────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.from_me
  const [imgExpanded, setImgExpanded] = useState(false)

  const rawImg = (() => {
    if (msg.message_type !== "imageMessage") return null
    try {
      const raw = msg.raw as Record<string, unknown>
      const imgMsg = (raw?.message as Record<string, unknown>)?.imageMessage as Record<string, unknown> | undefined
      return (imgMsg?.url as string) ?? null
    } catch { return null }
  })()

  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2, padding: "0 12px" }}>
      <div style={{ maxWidth: "65%", background: isMe ? "#dcf8c6" : "#ffffff", border: "1px solid", borderColor: isMe ? "#b7e4a0" : "#e5e7eb", borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px", padding: msg.message_type === "imageMessage" ? "4px 4px 8px" : "8px 12px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", overflow: "hidden" }}>

        {msg.message_type === "imageMessage" && (
          <div>
            {rawImg ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rawImg} alt="imagem" onClick={() => setImgExpanded(true)} style={{ width: "100%", maxWidth: 280, borderRadius: 8, display: "block", cursor: "zoom-in", objectFit: "cover" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
                {imgExpanded && (
                  <div onClick={() => setImgExpanded(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, cursor: "zoom-out" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rawImg} alt="expandida" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>🖼 Imagem</div>
            )}
            {msg.content && <div style={{ fontSize: 13, color: "#1a1d23", lineHeight: 1.5, padding: "6px 8px 2px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>}
          </div>
        )}

        {msg.message_type === "audioMessage" && (
          <div style={{ padding: "4px", display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
            <span style={{ fontSize: 18 }}>🎵</span>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Mensagem de voz</div>
          </div>
        )}

        {msg.message_type === "documentMessage" && (
          <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{msg.content ?? "Documento"}</div>
          </div>
        )}

        {msg.message_type === "stickerMessage" && (
          <div style={{ padding: "4px 8px", fontSize: 12, color: "var(--text-muted)" }}>🪄 Sticker</div>
        )}

        {(msg.message_type === "conversation" || msg.message_type === "extendedTextMessage") && msg.content && (
          <div style={{ fontSize: 13, color: "#1a1d23", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 4, paddingRight: msg.message_type === "imageMessage" ? 8 : 0 }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{formatMsgTime(msg.timestamp)}</span>
          {isMe && <span style={{ fontSize: 10, color: msg.status === "READ" ? "#3b82f6" : "#94a3b8" }}>{msg.status === "READ" || msg.status === "DELIVERED" ? "✓✓" : "✓"}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Separador de data ────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 11, color: "var(--text-muted)", background: "#e5ddd5", padding: "3px 12px", borderRadius: 99 }}>{formatDate(date)}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  )
}

// ─── Seção colapsável genérica ────────────────────────────────────────────────

function CollapsibleSection({ title, badge, badgeColor = "#6b7280", defaultOpen = false, children }: {
  title: string; badge?: string | number; badgeColor?: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", marginBottom: open ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em" }}>{title}</span>
          {badge !== undefined && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: badgeColor + "22", color: badgeColor, fontWeight: 600 }}>{badge}</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && children}
    </div>
  )
}

// ─── Coluna direita ───────────────────────────────────────────────────────────

function ContactPanel({ conv, onOpenConversation }: { conv: Conversation; onOpenConversation: (jid: string) => void }) {
  const [info, setInfo]           = useState<ContactInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [clienteId, setClienteId] = useState<number | null>(null)

  const fetchInfo = useCallback(async (cid?: number) => {
    setLoading(true)
    const params = new URLSearchParams({ jid: conv.jid })
    if (cid) params.set("cliente_id", String(cid))
    fetch(`/api/chat/contact?${params}`)
      .then(r => r.json()).then(d => {
        setInfo(d as ContactInfo)
        // Fixa o cliente carregado para trocar depois
        if (!cid && (d as ContactInfo).todos_clientes?.length > 0)
          setClienteId((d as ContactInfo).todos_clientes[0].id_cliente)
      }).catch(() => {})
      .finally(() => setLoading(false))
  }, [conv.jid])

  useEffect(() => { setInfo(null); setClienteId(null); fetchInfo() }, [conv.jid, fetchInfo])

  function handleSelectCliente(id: number) {
    setClienteId(id)
    fetchInfo(id)
  }

  const multiplos = (info?.todos_clientes?.length ?? 0) > 1

  return (
    <div style={{ width: 280, borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 }}>

      {/* Header */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg-elevated)" }}>
        <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={info?.profile_pic_url ?? conv.profile_pic_url} size={64} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{conv.profile_name ?? formatJid(conv.jid)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)", marginTop: 2 }}>+{formatJid(conv.jid)}</div>
        </div>

        {/* Seletor de cliente — aparece só quando há mais de um */}
        {multiplos && info && (
          <div style={{ width: "100%", marginTop: 4 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
              {info.todos_clientes.length} CLIENTES NESTE NÚMERO
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.todos_clientes.map(c => {
                const sc = c.status_principal ? statusColor(c.status_principal) : statusColor("")
                const ativo = clienteId === c.id_cliente
                return (
                  <button
                    key={c.id_cliente}
                    onClick={() => handleSelectCliente(c.id_cliente)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                      background: ativo ? "var(--bg-active)" : "var(--bg-surface)",
                      border: ativo ? "1px solid var(--border-light)" : "1px solid var(--border)",
                      textAlign: "left", transition: "all 0.12s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: ativo ? 600 : 400, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.nome}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>#{c.id_cliente}</div>
                    </div>
                    {c.status_principal && (
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0, fontWeight: 600 }}>
                        {c.status_principal}
                      </span>
                    )}
                    {ativo && <span style={{ fontSize: 10, color: "#2563eb", flexShrink: 0 }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>Buscando dados...</div>}

      {!loading && !info?.cliente && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12, background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center" }}>Não encontrado no js-painel</div>
        </div>
      )}

      {!loading && info?.cliente && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Dados básicos */}
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 10 }}>CLIENTE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <InfoRow label="Nome" value={info.cliente.nome} />
              <InfoRow label="ID" value={String(info.cliente.id_cliente)} mono />
              {info.cliente.score_fidelidade !== null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70 }}>Fidelidade</span>
                  <div style={{ flex: 1, height: 6, background: "var(--bg-elevated)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(info.cliente.score_fidelidade, 100)}%`, background: scoreColor(info.cliente.score_fidelidade), borderRadius: 99, transition: "width 0.5s" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(info.cliente.score_fidelidade), minWidth: 28, textAlign: "right" }}>
                    {Math.round(info.cliente.score_fidelidade)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Assinaturas */}
          {info.cliente.assinaturas.length > 0 && (
            <CollapsibleSection title="ASSINATURAS" badge={info.cliente.assinaturas.length} badgeColor="#16a34a" defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {info.cliente.assinaturas.map(a => {
                  const sc = statusColor(a.status)
                  const vencido = a.venc_contas ? new Date(a.venc_contas) < new Date() : false
                  const inativa = ["cancelado", "inativo", "inativa", "cancelada"].includes(a.status?.toLowerCase() ?? "")

                  // Assinaturas inativas/canceladas — linha simples
                  if (inativa) return (
                    <div key={a.id_assinatura} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, opacity: 0.6 }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>#{a.id_assinatura}</span>
                      <span style={{ flex: 1, fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.pacote?.contrato ?? a.plano?.tipo ?? "—"}
                      </span>
                      {a.venc_contas && <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{new Date(a.venc_contas).toLocaleDateString("pt-BR")}</span>}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>{a.status}</span>
                    </div>
                  )

                  // Assinaturas ativas/pendentes/vencidas — card completo
                  return (
                    <div key={a.id_assinatura} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>#{a.id_assinatura}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{a.status}</span>
                      </div>
                      {a.plano && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{a.plano.tipo}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>{formatCurrency(a.plano.valor)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.plano.telas} tela{a.plano.telas !== 1 ? "s" : ""} · {a.plano.meses} {a.plano.meses === 1 ? "mês" : "meses"}</div>
                          {a.plano.descricao && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{a.plano.descricao}</div>}
                        </div>
                      )}
                      {a.pacote && (
                        <div style={{ marginTop: 6, padding: "6px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6 }}>
                          <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 600, marginBottom: 3 }}>PACOTE</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {a.pacote.contrato && <span style={{ fontSize: 12, color: "#1e40af" }}>{a.pacote.contrato}</span>}
                            {a.pacote.telas && <span style={{ fontSize: 11, color: "#3b82f6" }}>{a.pacote.telas} tela{a.pacote.telas !== 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                      )}
                      {a.venc_contas && (
                        <div style={{ marginTop: 8, padding: "6px 8px", background: vencido ? "#fee2e2" : "#f0fdf4", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: vencido ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{vencido ? "CONTA VENCIDA" : "VENC. CONTA"}</span>
                          <span style={{ fontSize: 11, color: vencido ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{new Date(a.venc_contas).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {a.venc_contrato && (
                        <div style={{ marginTop: 4, padding: "6px 8px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 600 }}>VENC. CONTRATO</span>
                          <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>{new Date(a.venc_contrato).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {a.identificacao && <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>{a.identificacao}</div>}
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Aplicativos */}
          {info.cliente.aplicativos.length > 0 && (
            <CollapsibleSection title="APLICATIVOS" badge={info.cliente.aplicativos.length} badgeColor="#7c3aed">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {info.cliente.aplicativos.map(app => {
                  const sc = statusColor(app.status)
                  const vencido = app.validade ? new Date(app.validade) < new Date() : false
                  return (
                    <div key={app.id_app_registro} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{app.nome_app}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{app.status}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Chave</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-secondary)" }}>{app.chave}</span>
                        </div>
                        {app.mac && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>MAC</span>
                            <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-muted)" }}>{app.mac}</span>
                          </div>
                        )}
                        {app.validade && (
                          <div style={{ marginTop: 4, padding: "4px 8px", background: vencido ? "#fee2e2" : "#f0fdf4", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, color: vencido ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{vencido ? "VENCIDO" : "VALIDADE"}</span>
                            <span style={{ fontSize: 10, color: vencido ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{new Date(app.validade).toLocaleDateString("pt-BR")}</span>
                          </div>
                        )}
                        {app.observacao && <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>{app.observacao}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Indicações */}
          {info.cliente.indicacoes.length > 0 && (() => {
            const fez     = info.cliente.indicacoes.filter(i => i.tipo === "fez")
            const recebeu = info.cliente.indicacoes.filter(i => i.tipo === "recebeu")

            // Contadores por tipo com assinatura ativa
            const tipos = ["aberta", "cortesia", "comissao"] as const
            const resumo = tipos.map(t => {
              const grupo = fez.filter(i => i.bonificacao === t)
              const ativos = grupo.filter(i => i.assinatura_status === "ativo").length
              return { tipo: t, total: grupo.length, ativos }
            }).filter(r => r.total > 0)

            return (
              <CollapsibleSection title="INDICAÇÕES" badge={fez.length || undefined} badgeColor="#d97706">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

                  {/* Resumo por tipo */}
                  {resumo.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 4 }}>
                      {resumo.map(r => (
                        <div key={r.tipo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: "#fefce8", border: "1px solid #fef08a", borderRadius: 6 }}>
                          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600, textTransform: "capitalize" as const }}>{r.tipo}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: "#ca8a04" }}>{r.total} total</span>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#dcfce7", color: "#16a34a", fontWeight: 600, border: "1px solid #bbf7d0" }}>
                              {r.ativos} ativo{r.ativos !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista de nomes */}
                  {fez.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {fez.map(ind => (
                        <div key={ind.id_indicacao} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6 }}>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "#fef9c3", color: "#ca8a04", fontWeight: 700, flexShrink: 0, textTransform: "capitalize" as const }}>
                            {ind.bonificacao ?? "—"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {ind.jid_outro_cliente ? (
                              <button onClick={() => onOpenConversation(ind.jid_outro_cliente!)}
                                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 500, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "block" }}>
                                {ind.nome_outro_cliente}
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                                {ind.nome_outro_cliente}
                              </span>
                            )}
                          </div>
                          {ind.assinatura_status && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, flexShrink: 0, fontWeight: 600, ...( ind.assinatura_status === "ativo" ? { background: "#dcfce7", color: "#16a34a" } : { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }) }}>
                              {ind.assinatura_status}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                            {new Date(ind.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quem indicou este cliente — sublinha única */}
                  {recebeu.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, opacity: 0.75 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>←</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Indicado por</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {recebeu[0].jid_outro_cliente ? (
                          <button onClick={() => onOpenConversation(recebeu[0].jid_outro_cliente!)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#2563eb", fontWeight: 500, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%", display: "block" }}>
                            {recebeu[0].nome_outro_cliente}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{recebeu[0].nome_outro_cliente}</span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </CollapsibleSection>
            )
          })()}

        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: mono ? "var(--mono)" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

// ─── Área de mensagens ────────────────────────────────────────────────────────

function MessagesArea({ conv }: { conv: Conversation }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState("")
  const [sending, setSending]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const prevLen   = useRef(0)

  const loadMessages = useCallback(async () => {
    try {
      const res  = await fetch(`/api/chat/messages/${encodeURIComponent(conv.jid)}?limit=50`)
      const data = await res.json() as { messages: Message[] }
      if (Array.isArray(data.messages)) setMessages(data.messages)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [conv.jid])

  useEffect(() => { setLoading(true); setMessages([]); loadMessages() }, [conv.jid, loadMessages])

  useEffect(() => {
    if (messages.length > prevLen.current)
      bottomRef.current?.scrollIntoView({ behavior: messages.length === prevLen.current + 1 ? "smooth" : "auto" })
    prevLen.current = messages.length
  }, [messages.length])

  useEffect(() => { const t = setInterval(loadMessages, 3000); return () => clearInterval(t) }, [loadMessages])

  async function handleSend() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true); setText("")
    const tempMsg: Message = { id: `temp_${Date.now()}`, jid: conv.jid, from_me: true, message_type: "conversation", content: t, media_url: null, status: "PENDING", timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, tempMsg])
    try {
      await fetch("/api/chat/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jid: conv.jid, text: t }) })
      await loadMessages()
    } catch { /* silencioso */ }
    finally { setSending(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  let lastDate = ""

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "#f0f2f5" }}>
        <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={conv.profile_pic_url} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{conv.profile_name ?? formatJid(conv.jid)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>+{formatJid(conv.jid)}</div>
        </div>
        {conv.shadow_mode && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#7c3aed22", color: "#7c3aed", fontWeight: 600, border: "1px solid #7c3aed33" }}>◆ sombra</span>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", background: "#e5ddd5" }}>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 13 }}>Carregando mensagens...</div>}
        {!loading && messages.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#888", fontSize: 13 }}>Nenhuma mensagem ainda.</div>}
        {messages.map(msg => {
          const msgDate = new Date(msg.timestamp).toDateString()
          const showDate = msgDate !== lastDate
          lastDate = msgDate
          return (
            <div key={msg.id}>
              {showDate && <DateSeparator date={msg.timestamp} />}
              <MessageBubble msg={msg} />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "#f0f2f5", display: "flex", alignItems: "flex-end", gap: 8 }}>
        <textarea
          ref={inputRef} value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          style={{ flex: 1, resize: "none", borderRadius: 24, padding: "10px 16px", fontSize: 13, background: "#fff", border: "none", maxHeight: 120, lineHeight: 1.5, overflowY: "auto", outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
          onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px" }}
        />
        <button onClick={handleSend} disabled={!text.trim() || sending}
          style={{ width: 42, height: 42, borderRadius: "50%", background: text.trim() ? "#16a34a" : "#ccc", border: "none", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}>
          ➤
        </button>
      </div>
    </div>
  )
}

// ─── Botão de importar ────────────────────────────────────────────────────────

function ImportButton({ onImported }: { onImported: () => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  async function handleImport() {
    setLoading(true); setResult(null)
    try {
      const res  = await fetch("/api/chat/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 200 }) })
      const data = await res.json() as { imported?: number; error?: string }
      setResult(data.error ? "Erro" : `+${data.imported}`)
      if (!data.error) onImported()
    } catch { setResult("Erro") }
    finally { setLoading(false); setTimeout(() => setResult(null), 3000) }
  }

  return (
    <button onClick={handleImport} disabled={loading} title="Importar conversas da Evolution API"
      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 99, background: result === "Erro" ? "#fee2e2" : result ? "#dcfce7" : "var(--bg-elevated)", color: result === "Erro" ? "#dc2626" : result ? "#16a34a" : "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 500, transition: "all 0.2s" }}>
      {loading ? "..." : result ?? "↓ importar"}
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [search, setSearch]     = useState("")
  const [loading, setLoading]   = useState(true)

  const loadConversations = useCallback(async () => {
    try {
      const res  = await fetch("/api/chat/conversations")
      const data: unknown = await res.json()
      if (Array.isArray(data)) setConversations(data as Conversation[])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadConversations()
    const t = setInterval(loadConversations, 5000)
    return () => clearInterval(t)
  }, [loadConversations])

  // Abre conversa por JID (usado pelo botão de indicação)
  function openByJid(jid: string) {
    const found = conversations.find(c => c.jid === jid)
    if (found) { setSelected(found); return }
    // Cria entrada temporária se não existir ainda na lista
    setSelected({ jid, instance: "jsevolution", profile_name: null, profile_pic_url: null, last_message: null, last_message_at: null, unread_count: 0, is_client: null, shadow_mode: true, muted: false })
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return (c.profile_name ?? "").toLowerCase().includes(q) || c.jid.includes(q)
  })

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Lista */}
      <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", background: "#f0f2f5" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1d23" }}>Conversas</div>
            <ImportButton onImported={loadConversations} />
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{ width: "100%", padding: "8px 12px", borderRadius: 24, fontSize: 13, background: "#fff", border: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Carregando...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>{search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}</div>}
          {filtered.map(conv => (
            <ConversationItem key={conv.jid} conv={conv} active={selected?.jid === conv.jid} onClick={() => setSelected(conv)} />
          ))}
        </div>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selected ? (
          <MessagesArea key={selected.jid} conv={selected} />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12, background: "#e5ddd5" }}>
            <div style={{ fontSize: 48, opacity: 0.4 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>JS Lab Chat</div>
            <div style={{ fontSize: 13 }}>Selecione uma conversa para começar</div>
          </div>
        )}
      </div>

      {/* Coluna direita */}
      {selected && <ContactPanel key={selected.jid} conv={selected} onOpenConversation={openByJid} />}
    </div>
  )
}