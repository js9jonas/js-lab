"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getContactName } from "@/lib/contact-lookup"
import type { ContactInfo } from "@/app/api/chat/contact/route"
import type { GroupMetadata } from "@/app/api/chat/group-metadata/route"
import AudioPlayer from "@/components/chat/AudioPlayer"
import ImageLightbox from "@/components/chat/ImageLightbox"
import ImagePreview, { fileToAttachment, type ImageAttachment } from "@/components/chat/ImagePreview"
import PdfPreview from "@/components/chat/PdfPreview"
import QuickRepliesModal from "@/components/chat/QuickRepliesModal"
import StickerBubble from "@/components/chat/StickerBubble"
import StickerPreview from "@/components/chat/StickerPreview"

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
  pinned: boolean
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
  reactions?: Record<string, string> | null
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

function Avatar({ name, pic, size = 40, onClick }: { name?: string | null; pic?: string | null; size?: number; onClick?: () => void }) {
  const initials = name ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() : "?"
  const clickStyle: React.CSSProperties = onClick ? { cursor: "pointer" } : {}
  if (pic) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pic} alt="" onClick={onClick} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid var(--border)", ...clickStyle }} />
  )
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, color: "#64748b", flexShrink: 0, ...clickStyle }}>
      {initials}
    </div>
  )
}

// ─── PhotoOverlay ─────────────────────────────────────────────────────────────

function PhotoOverlay({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function download() {
    const a = document.createElement("a")
    a.href = src; a.download = name; a.target = "_blank"; a.click()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
    >
      {/* Botões */}
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 14, right: 18, display: "flex", gap: 8 }}>
        <button onClick={download} title="Download" style={photoOverlayBtn}>⬇</button>
        <button onClick={onClose}  title="Fechar"   style={photoOverlayBtn}>✕</button>
      </div>
      {/* Foto */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 600, maxHeight: 600, borderRadius: 12, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
      />
      <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, fontSize: 13, color: "#e2e8f0" }}>{name}</div>
    </div>
  )
}

const photoOverlayBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  background: "rgba(255,255,255,0.15)", border: "none",
  color: "#fff", fontSize: 14, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
}

// ─── Item da lista ────────────────────────────────────────────────────────────

function ConversationItem({ conv, active, onClick, onPinToggled }: {
  conv: Conversation
  active: boolean
  onClick: () => void
  onPinToggled: (jid: string, pinned: boolean) => void
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  async function togglePin() {
    setMenu(null)
    const newVal = !conv.pinned
    await fetch("/api/chat/pin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jid: conv.jid, pinned: newVal }),
    })
    onPinToggled(conv.jid, newVal)
  }

  const isGroup = conv.jid.endsWith("@g.us")
  const [contactName, setContactName] = useState<string | null>(null)
  useEffect(() => {
    if (isGroup) return
    getContactName(conv.jid, conv.profile_name).then(setContactName)
  }, [conv.jid, conv.profile_name, isGroup])
  const displayName = contactName ?? conv.profile_name ?? (isGroup ? "Grupo" : formatJid(conv.jid))

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
          cursor: "pointer",
          background: active ? (isGroup ? "#ede9fe" : "#e8f5e9") : conv.pinned ? "#f0f9ff" : "transparent",
          borderBottom: "1px solid var(--border)",
          borderLeft: isGroup ? "3px solid #7c3aed" : "3px solid transparent",
          transition: "background 0.12s",
          position: "relative",
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = conv.pinned ? "#e0f2fe" : isGroup ? "#f5f3ff" : "var(--bg-hover)" }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = conv.pinned ? "#f0f9ff" : "transparent" }}
      >
        {/* Avatar com badge de grupo */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar name={displayName} pic={conv.profile_pic_url} size={44} />
          {isGroup && (
            <span style={{
              position: "absolute", bottom: -2, right: -2,
              background: "#7c3aed", color: "#fff", borderRadius: 99,
              fontSize: 8, fontWeight: 700, padding: "1px 4px", lineHeight: "14px",
              border: "1.5px solid #fff", whiteSpace: "nowrap",
            }}>
              GRP
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontWeight: conv.unread_count > 0 ? 600 : 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140, color: isGroup ? "#5b21b6" : undefined }}>
              {displayName}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {conv.pinned && <span style={{ fontSize: 10, color: "#0ea5e9" }} title="Fixada">📌</span>}
              <span style={{ fontSize: 10, color: conv.unread_count > 0 ? "#16a34a" : "var(--text-muted)" }}>
                {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
              {conv.last_message ?? "Sem mensagens"}
            </span>
            {conv.unread_count > 0 && (
              <span style={{ background: isGroup ? "#7c3aed" : "#16a34a", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px", flexShrink: 0, marginLeft: 4 }}>
                {conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu de contexto */}
      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 900 }} />
          <div style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 901, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.13)", minWidth: 170, overflow: "hidden" }}>
            <button
              onClick={togglePin}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1a1d23", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span>{conv.pinned ? "📌" : "📌"}</span>
              {conv.pinned ? "Desafixar conversa" : "Fixar no topo"}
            </button>
          </div>
        </>
      )}
    </>
  )
}

// ─── Modal de encaminhar ──────────────────────────────────────────────────────

function ForwardModal({ msg, instance, onClose }: { msg: Message; instance: string; onClose: () => void }) {
  const [convs, setConvs]     = useState<{ jid: string; profile_name: string | null }[]>([])
  const [search, setSearch]   = useState("")
  const [sending, setSending] = useState<string | null>(null)
  const [done, setDone]       = useState<string[]>([])

  useEffect(() => {
    fetch("/api/chat/conversations")
      .then(r => r.json())
      .then((d: { conversations?: { jid: string; profile_name: string | null }[] }) =>
        setConvs(d.conversations ?? []))
      .catch(() => {})
  }, [])

  const filtered = convs.filter(c =>
    c.jid !== msg.jid &&
    (c.profile_name ?? formatJid(c.jid)).toLowerCase().includes(search.toLowerCase())
  )

  async function forward(targetJid: string) {
    if (sending || done.includes(targetJid)) return
    setSending(targetJid)
    await fetch("/api/chat/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jid: targetJid, text: msg.content ?? "[mídia]", instance }),
    })
    setDone(d => [...d, targetJid])
    setSending(null)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 340, maxHeight: 520, display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Encaminhar mensagem</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>✕</button>
        </div>
        <div style={{ padding: "8px 12px" }}>
          <input
            autoFocus
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Nenhuma conversa encontrada</div>}
          {filtered.map(c => {
            const sent = done.includes(c.jid)
            return (
              <button
                key={c.jid}
                onClick={() => forward(c.jid)}
                disabled={!!sending || sent}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: sent ? "default" : "pointer", textAlign: "left" }}
                onMouseEnter={e => { if (!sent) (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb" }}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "none"}
              >
                <Avatar name={c.profile_name ?? formatJid(c.jid)} size={36} />
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.profile_name ?? formatJid(c.jid)}
                </span>
                {sending === c.jid && <span style={{ fontSize: 11, color: "#9ca3af" }}>enviando...</span>}
                {sent && <span style={{ fontSize: 16, color: "#22c55e" }}>✓</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Balão de mensagem ────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]

function MessageBubble({ msg, instance, isGroup, onReply, onForward, onDelete, selectionMode, selected, onToggleSelect, onOpenConversation }: {
  msg: Message
  instance: string
  isGroup?: boolean
  onReply: (msg: Message) => void
  onForward: (msg: Message) => void
  onDelete: (msg: Message) => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onOpenConversation?: (jid: string) => void
}) {
  const isMe = msg.from_me
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imgError, setImgError]         = useState(false)
  const [imgRetry, setImgRetry]         = useState(0)
  const [hovered, setHovered]           = useState(false)
  const [pickerOpen, setPickerOpen]     = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [infoOpen, setInfoOpen]         = useState(false)
  const [localReactions, setLocalReactions] = useState<Record<string, string> | null>(msg.reactions ?? null)

  const participantJid = isGroup && !isMe
    ? (() => { try { const r = msg.raw as Record<string, unknown>; return ((r?.key as Record<string, unknown>)?.participant as string) ?? (r?.participant as string) ?? null } catch { return null } })()
    : null
  const [senderName, setSenderName] = useState<string | null>(null)
  useEffect(() => {
    if (!participantJid) return
    getContactName(participantJid).then(setSenderName)
  }, [participantJid])

  async function sendReaction(emoji: string) {
    setPickerOpen(false)
    // Update otimista: chave "me" representa minha reação
    setLocalReactions(prev => {
      const updated = { ...(prev ?? {}) }
      if (emoji) updated["me"] = emoji
      else delete updated["me"]
      return Object.keys(updated).length > 0 ? updated : null
    })
    await fetch("/api/chat/send-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instance, jid: msg.jid, messageId: msg.id, fromMe: msg.from_me, reaction: emoji }),
    })
  }

  function toggleMyReaction() {
    const myEmoji = localReactions?.["me"]
    sendReaction(myEmoji ? "" : "👍") // remove se já reagiu, adiciona 👍 como toggle rápido
  }

  const rawImg = (() => {
    if (msg.message_type !== "imageMessage") return null
    console.log("[img-debug] msg.id:", msg.id)
    console.log("[img-debug] msg.media_url:", msg.media_url)
    console.log("[img-debug] msg.raw type:", typeof msg.raw)
    try {
      const raw = msg.raw as Record<string, unknown>
      console.log("[img-debug] raw keys:", Object.keys(raw))
      console.log("[img-debug] raw.mediaUrl existe:", !!raw?.mediaUrl)
      console.log("[img-debug] raw.mediaUrl início:",
        typeof raw?.mediaUrl === "string" ? (raw.mediaUrl as string).slice(0, 50) : "não é string")
    } catch (e) {
      console.log("[img-debug] erro:", e)
    }
    try {
      const raw = msg.raw as Record<string, unknown>
      // 1. raw.mediaUrl: base64 data URL (permanente, funciona no browser)
      const dataUrl = raw?.mediaUrl as string | undefined
      if (dataUrl) return dataUrl
      // 2. media_url: CDN URL salva no banco (pode expirar ou exigir auth)
      if (msg.media_url) return msg.media_url
      // 3. raw.message.imageMessage.url: CDN URL dentro do raw (último recurso)
      const imgMsg = (raw?.message as Record<string, unknown>)?.imageMessage as Record<string, unknown> | undefined
      return (imgMsg?.url as string) ?? null
    } catch { return null }
  })()

  // Extrai citação do contextInfo (mensagens de reply)
  const quotedBlock = (() => {
    try {
      const raw = msg.raw as Record<string, unknown>
      const ctx = ((raw?.message as Record<string, unknown>)
        ?.extendedTextMessage as Record<string, unknown>)
        ?.contextInfo as Record<string, unknown> | undefined
      if (!ctx) return null
      const quotedMsg  = ctx.quotedMessage as Record<string, unknown> | undefined
      if (!quotedMsg) return null
      const text =
        (quotedMsg.conversation as string) ??
        ((quotedMsg.extendedTextMessage as Record<string, unknown>)?.text as string) ??
        ((quotedMsg.imageMessage as Record<string, unknown>)?.caption as string) ??
        null
      const isImage  = !!quotedMsg.imageMessage
      const senderName = (ctx._quotedSenderName as string) ?? formatJid(ctx.participant as string ?? "")
      return { text, isImage, senderName }
    } catch { return null }
  })()

  // Agrupa reações: { emoji: count }
  const reactionSummary = (() => {
    if (!localReactions) return null
    const map: Record<string, number> = {}
    for (const emoji of Object.values(localReactions)) {
      if (emoji) map[emoji] = (map[emoji] ?? 0) + 1
    }
    return Object.keys(map).length > 0 ? map : null
  })()
  const myReactionEmoji = localReactions?.["me"] ?? null

  if (infoOpen) return (
    <div
      onClick={() => setInfoOpen(false)}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: 320, padding: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Dados da mensagem</span>
          <button onClick={() => setInfoOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#6b7280" }}>✕</button>
        </div>
        {[
          ["ID",      msg.id],
          ["Tipo",    msg.message_type],
          ["Horário", new Date(msg.timestamp).toLocaleString("pt-BR")],
          ["Status",  msg.status ?? "—"],
          ["De",      msg.from_me ? "Você" : formatJid(msg.jid)],
          ["JID",     msg.jid],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.06em" }}>{label}</span>
            <span style={{ fontSize: 12, color: "#1a1d23", wordBreak: "break-all", fontFamily: label === "ID" || label === "JID" ? "monospace" : "inherit" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div
      style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 2, padding: "0 12px", background: selected ? "rgba(37,99,235,0.07)" : "transparent", transition: "background 0.1s" }}
      onMouseEnter={() => { if (!selectionMode) setHovered(true) }}
      onMouseLeave={() => { setHovered(false); setPickerOpen(false); setDropdownOpen(false) }}
      onClick={() => { if (selectionMode) onToggleSelect(msg.id) }}
    >
      {/* Checkbox no modo seleção */}
      {selectionMode && (
        <div style={{ display: "flex", alignItems: "center", paddingRight: isMe ? 0 : 8, paddingLeft: isMe ? 8 : 0, order: isMe ? 1 : -1 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selected ? "#2563eb" : "#d1d5db"}`, background: selected ? "#2563eb" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
            {selected && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
          </div>
        </div>
      )}
      {/* Inner: botão de reação + balão lado a lado */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, flexDirection: isMe ? "row-reverse" : "row" }}>

        {/* Balão */}
        <div style={{ maxWidth: "100%", position: "relative", background: msg.message_type === "stickerMessage" ? "transparent" : isMe ? "#dcf8c6" : "#ffffff", border: msg.message_type === "stickerMessage" ? "none" : "1px solid", borderColor: isMe ? "#b7e4a0" : "#e5e7eb", borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px", padding: msg.message_type === "imageMessage" ? "4px 4px 8px" : msg.message_type === "stickerMessage" ? 0 : "8px 12px", boxShadow: msg.message_type === "stickerMessage" ? "none" : "0 1px 2px rgba(0,0,0,0.06)", overflow: "visible" }}>

        {/* Botão de contexto — canto superior, aparece no hover */}
        {hovered && !selectionMode && msg.message_type !== "stickerMessage" && (
          <div style={{ position: "absolute", top: 2, [isMe ? "right" : "left"]: 4, zIndex: 10 }}>
            {/* gradiente que faz o botão aparecer suavemente sobre o conteúdo */}
            <div style={{ position: "absolute", top: 0, [isMe ? "right" : "left"]: 0, width: 44, height: 26, background: `linear-gradient(${isMe ? "to right" : "to left"}, ${isMe ? "#dcf8c6" : "#ffffff"} 60%, transparent)`, pointerEvents: "none", borderRadius: 4 }} />
            <button
              onClick={e => { e.stopPropagation(); setDropdownOpen(p => !p) }}
              style={{ position: "relative", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6b7280", padding: "0 4px", lineHeight: 1, height: 22 }}
            >
              ▾
            </button>
            {dropdownOpen && (
              <div
                style={{ position: "absolute", top: 24, [isMe ? "right" : "left"]: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 170, zIndex: 200, overflow: "hidden" }}
                onClick={e => e.stopPropagation()}
              >
                {[
                  { label: "Dados da mensagem", icon: "ℹ️", action: () => { setDropdownOpen(false); setInfoOpen(true) } },
                  { label: "Responder",          icon: "↩️", action: () => { setDropdownOpen(false); onReply(msg) } },
                  { label: "Encaminhar",         icon: "↪️", action: () => { setDropdownOpen(false); onForward(msg) } },
                  { label: "Apagar",             icon: "🗑️", action: () => { setDropdownOpen(false); onDelete(msg) }, danger: true },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: (item as { danger?: boolean }).danger ? "#ef4444" : "#1a1d23", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Nome do remetente em grupos */}
        {isGroup && !isMe && senderName && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", marginBottom: 3 }}>
            {senderName}
          </div>
        )}

        {/* Bloco de citação (reply) */}
        {quotedBlock && (
          <div style={{ borderLeft: `3px solid ${isMe ? "#25d366" : "#2563eb"}`, borderRadius: "4px 6px 6px 4px", background: isMe ? "rgba(0,0,0,0.06)" : "rgba(37,99,235,0.07)", padding: "5px 10px", marginBottom: 6, cursor: "default" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: isMe ? "#128c3e" : "#2563eb", marginBottom: 2 }}>
              {quotedBlock.senderName}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
              {quotedBlock.isImage ? "🖼 Imagem" : (quotedBlock.text ?? "[mídia]")}
            </div>
          </div>
        )}

        {msg.message_type === "imageMessage" && (
          <div>
            {rawImg && !imgError ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={imgRetry}
                  src={rawImg}
                  alt="imagem"
                  onClick={() => setLightboxOpen(true)}
                  onError={() => setImgError(true)}
                  style={{ width: "100%", maxWidth: 280, maxHeight: 320, borderRadius: 8, display: "block", cursor: "zoom-in", objectFit: "cover" }}
                />
                {lightboxOpen && (
                  <ImageLightbox src={rawImg} caption={msg.content} onClose={() => setLightboxOpen(false)} />
                )}
              </>
            ) : (
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🖼</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {imgError ? "Imagem não disponível" : "Imagem"}
                </span>
                {imgError && (
                  <button
                    onClick={() => { setImgError(false); setImgRetry(r => r + 1) }}
                    style={{ fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    tentar novamente
                  </button>
                )}
              </div>
            )}
            {rawImg && !imgError && msg.content && (
              <div style={{ fontSize: 13, color: "#1a1d23", lineHeight: 1.5, padding: "6px 8px 2px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
            )}
          </div>
        )}

        {msg.message_type === "audioMessage" && (
          <AudioPlayer messageId={msg.id} instance={instance} fromMe={isMe} />
        )}

        {msg.message_type === "documentMessage" && (
          <PdfPreview
            messageId={msg.id}
            instance={instance}
            raw={msg.raw}
            fromMe={isMe}
          />
        )}

        {msg.message_type === "stickerMessage" && (
          <StickerBubble messageId={msg.id} instance={instance} raw={msg.raw} />
        )}

        {msg.message_type === "contactMessage" && (() => {
          try {
            const raw = msg.raw as Record<string, unknown>
            const contactMsg = ((raw?.message as Record<string, unknown>)
              ?.contactMessage as Record<string, unknown> | undefined)
            const displayName = (contactMsg?.displayName as string) ?? null
            const vcard = (contactMsg?.vcard as string) ?? null
            const phone = vcard?.match(/waid=(\d+):/)?.[1] ?? null
            const jid = phone ? `${phone}@s.whatsapp.net` : null
            return (
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 2px", minWidth: 160, cursor: jid ? "pointer" : "default" }}
                onClick={jid && onOpenConversation ? () => onOpenConversation(jid) : undefined}
                title={jid ? "Abrir conversa" : undefined}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  👤
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: jid ? "#7c3aed" : "#1a1d23" }}>{displayName ?? "Contato"}</div>
                  {phone && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>+{phone}</div>}
                </div>
              </div>
            )
          } catch { return null }
        })()}

        {(msg.message_type === "conversation" || msg.message_type === "extendedTextMessage") && msg.content && (
          <div style={{ fontSize: 13, color: "#1a1d23", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 4, paddingRight: msg.message_type === "imageMessage" ? 8 : 0 }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{formatMsgTime(msg.timestamp)}</span>
          {isMe && <span style={{ fontSize: 10, color: msg.status === "READ" ? "#3b82f6" : "#94a3b8" }}>{msg.status === "READ" || msg.status === "DELIVERED" ? "✓✓" : "✓"}</span>}
        </div>

        {/* Reações — aparecem grudadas na borda inferior do balão */}
        {reactionSummary && (
          <div style={{ position: "absolute", bottom: -16, [isMe ? "right" : "left"]: 8, display: "flex", gap: 2, zIndex: 1 }}>
            {Object.entries(reactionSummary).map(([emoji, count]) => {
              const isMine = myReactionEmoji === emoji
              return (
                <button
                  key={emoji}
                  onClick={() => sendReaction(isMine ? "" : emoji)}
                  title={isMine ? "Remover reação" : "Reagir com " + emoji}
                  style={{ fontSize: 13, background: isMine ? "#dbeafe" : "#fff", border: `1px solid ${isMine ? "#93c5fd" : "#e5e7eb"}`, borderRadius: 99, padding: "1px 6px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", lineHeight: 1.4, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
                >
                  {emoji}
                  {count > 1 && <span style={{ fontSize: 10, color: "#6b7280" }}>{count}</span>}
                </button>
              )
            })}
          </div>
        )}
        </div>{/* fim balão */}

        {/* Botão de reação — aparece no hover, ao lado do balão */}
        {hovered && !selectionMode && (
          <div style={{ position: "relative", alignSelf: "center", flexShrink: 0 }}>
            <button
              onClick={() => setPickerOpen(p => !p)}
              title="Reagir"
              style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
            >
              😊
            </button>
            {pickerOpen && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", [isMe ? "right" : "left"]: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", padding: "4px 8px", gap: 4, zIndex: 100, whiteSpace: "nowrap" }}>
                {REACTION_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "2px 4px", borderRadius: 8, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>{/* fim inner row */}
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

// ─── Painel de grupo ─────────────────────────────────────────────────────────

function GroupPanel({ conv, onGroupNameResolved }: { conv: Conversation; onGroupNameResolved: (jid: string, name: string) => void }) {
  const [meta, setMeta]           = useState<GroupMetadata | null>(null)
  const [loading, setLoading]     = useState(true)
  const [photoOpen, setPhotoOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchMeta() {
      setLoading(true)
      try {
        const res = await fetch(`/api/chat/group-metadata?instance=${encodeURIComponent(conv.instance)}&jid=${encodeURIComponent(conv.jid)}`)
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json() as GroupMetadata
        if (cancelled) return
        setMeta(data)
        if (data.subject && !conv.profile_name) {
          onGroupNameResolved(conv.jid, data.subject)
        }
      } catch { /* silencioso */ }
      finally { if (!cancelled) setLoading(false) }
    }
    fetchMeta()
    return () => { cancelled = true }
  }, [conv.jid, conv.instance, conv.profile_name, onGroupNameResolved])

  const displayName = conv.profile_name ?? meta?.subject ?? formatJid(conv.jid)
  const picUrl      = meta?.pictureUrl ?? conv.profile_pic_url

  return (
    <div style={{ width: 280, borderLeft: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 }}>

      {/* Header */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--bg-elevated)" }}>
        <Avatar
          name={displayName}
          pic={picUrl}
          size={64}
          onClick={picUrl ? () => setPhotoOpen(true) : undefined}
        />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {loading && !conv.profile_name ? "Carregando..." : displayName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Grupo</div>
        </div>
      </div>

      {/* Metadados */}
      {!loading && meta && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em" }}>INFORMAÇÕES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 90 }}>Participantes</span>
              <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>{meta.participantsCount}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 90 }}>JID</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--mono)", wordBreak: "break-all" }}>{conv.jid}</span>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>Buscando dados do grupo...</div>
      )}

      {photoOpen && picUrl && (
        <PhotoOverlay src={picUrl} name={displayName} onClose={() => setPhotoOpen(false)} />
      )}
    </div>
  )
}

// ─── Coluna direita ───────────────────────────────────────────────────────────

function ContactPanel({ conv, onOpenConversation }: { conv: Conversation; onOpenConversation: (jid: string) => void }) {
  const [info, setInfo]           = useState<ContactInfo | null>(null)
  const [loading, setLoading]     = useState(true)
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [photoOpen, setPhotoOpen] = useState(false)

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
        {(() => {
          const picUrl = info?.profile_pic_url ?? conv.profile_pic_url
          return (
            <Avatar
              name={info?.todos_clientes[0]?.nome ?? conv.profile_name ?? formatJid(conv.jid)}
              pic={picUrl}
              size={64}
              onClick={picUrl ? () => setPhotoOpen(true) : undefined}
            />
          )
        })()}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{info?.todos_clientes[0]?.nome ?? conv.profile_name ?? formatJid(conv.jid)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)", marginTop: 2 }}>+{formatJid(conv.jid)}</div>
        </div>
        {photoOpen && (info?.profile_pic_url ?? conv.profile_pic_url) && (
          <PhotoOverlay src={(info?.profile_pic_url ?? conv.profile_pic_url)!} name={info?.todos_clientes[0]?.nome ?? conv.profile_name ?? formatJid(conv.jid)} onClose={() => setPhotoOpen(false)} />
        )}

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

// ─── Modal de refinamento do agente ──────────────────────────────────────────

interface ModuloSugerido { nome: string; descricao: string | null; gatilhos: string[]; conteudo: string }
interface ChatRefinMsg   { role: "user" | "assistant"; content: string }

function AgenteRefinamentoModal({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [msgs, setMsgs]                         = useState<ChatRefinMsg[]>([])
  const [input, setInput]                       = useState("")
  const [sending, setSending]                   = useState(false)
  const [agenteId, setAgenteId]                 = useState<number | null>(null)
  const [agenteNome, setAgenteNome]             = useState<string | null>(null)
  const [promptSugerido, setPromptSugerido]     = useState<string | null>(null)
  const [modulosSugeridos, setModulosSugeridos] = useState<ModuloSugerido[]>([])
  const [salvandoPrompt, setSalvandoPrompt]     = useState(false)
  const [salvoPrompt, setSalvoPrompt]           = useState(false)
  const [erroAgente, setErroAgente]             = useState<string | null>(null)
  const [erroSalvar, setErroSalvar]             = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs.length])

  async function handleSend() {
    const txt = input.trim()
    if (!txt || sending) return
    setInput("")
    setSending(true)
    setMsgs(prev => [...prev, { role: "user", content: txt }])
    setErroAgente(null)
    try {
      const res = await fetch("/api/chat/refinamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid: conv.jid, instance: conv.instance, message: txt, historico: msgs }),
      })
      const data = await res.json() as {
        resposta?: string; promptSugerido?: string; modulosSugeridos?: ModuloSugerido[]
        agente_id?: number; agente_nome?: string; error?: string
      }
      if (data.error) { setErroAgente(data.error); setMsgs(prev => prev.slice(0, -1)); return }
      if (data.resposta)        setMsgs(prev => [...prev, { role: "assistant", content: data.resposta! }])
      if (data.agente_id)       setAgenteId(data.agente_id)
      if (data.agente_nome)     setAgenteNome(data.agente_nome)
      if (data.promptSugerido)  setPromptSugerido(data.promptSugerido)
      if (data.modulosSugeridos?.length) setModulosSugeridos(prev => [...prev, ...data.modulosSugeridos!])
    } catch { setErroAgente("Erro de conexão.") }
    finally { setSending(false) }
  }

  async function handleSalvarPrompt() {
    if (!promptSugerido) return
    if (!agenteId) { setErroSalvar("ID do agente não encontrado. Envie uma mensagem primeiro."); return }
    setSalvandoPrompt(true); setErroSalvar(null)
    try {
      const res = await fetch(`/api/agentes/${agenteId}/prompt`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptSugerido, motivo: "Refinado via chat sobre conversa real" }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) { setErroSalvar(data.error ?? `Erro HTTP ${res.status}`); return }
      setSalvoPrompt(true); setPromptSugerido(null)
      setTimeout(() => setSalvoPrompt(false), 3000)
    } catch (err) {
      setErroSalvar("Erro de conexão ao salvar prompt: " + String(err))
    } finally {
      setSalvandoPrompt(false)
    }
  }

  async function handleSalvarModulo(m: ModuloSugerido, idx: number) {
    if (!agenteId) { setErroSalvar("ID do agente não encontrado. Envie uma mensagem primeiro."); return }
    setErroSalvar(null)
    try {
      const res = await fetch(`/api/agentes/${agenteId}/modulos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) { setErroSalvar(data.error ?? `Erro HTTP ${res.status} ao salvar módulo`); return }
      setModulosSugeridos(prev => prev.filter((_, i) => i !== idx))
    } catch (err) {
      setErroSalvar("Erro de conexão ao salvar módulo: " + String(err))
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: 680, maxWidth: "95vw", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 48px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0369a1" }}>◇ Refinar agente</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              {agenteNome ? `Agente: ${agenteNome} · ` : ""}Contexto: {conv.profile_name ?? conv.jid}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>

        {/* Área de scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Prompt sugerido */}
          {promptSugerido && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>◆ Novo prompt base sugerido</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setPromptSugerido(null)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid #bbf7d0", color: "#16a34a", cursor: "pointer" }}>Descartar</button>
                  <button onClick={handleSalvarPrompt} disabled={salvandoPrompt} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    {salvandoPrompt ? "..." : salvoPrompt ? "✓ Salvo!" : "✓ Aprovar"}
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
            <div key={idx} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: 14, flexShrink: 0 }}>
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

          {/* Mensagens do chat */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.length === 0 && !erroAgente && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ca3af", fontSize: 13 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◇</div>
                Converse com o agente sobre esta conversa.<br />
                Ele analisa as mensagens reais e pode sugerir melhorias no prompt e módulos.
              </div>
            )}
            {erroAgente && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                {erroAgente}
              </div>
            )}
            {msgs.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: msg.role === "user" ? "12px 2px 12px 12px" : "2px 12px 12px 12px", background: msg.role === "user" ? "#0369a1" : "#f8fafc", color: msg.role === "user" ? "#fff" : "#1e293b", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none" }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: "2px 12px 12px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: 13 }}>Analisando conversa...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {erroSalvar && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{erroSalvar}</span>
              <button onClick={() => setErroSalvar(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, padding: "0 4px" }}>✕</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Pergunte sobre a conversa, peça análise, sugira melhorias... (Enter para enviar)"
              rows={2}
              style={{ flex: 1, resize: "none", padding: "9px 12px", fontSize: 13, borderRadius: 10, border: "1px solid #e2e8f0", outline: "none", lineHeight: 1.5, fontFamily: "inherit" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: "50%", background: input.trim() && !sending ? "#0369a1" : "#e2e8f0", border: "none", color: input.trim() && !sending ? "#fff" : "#94a3b8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Área de mensagens ────────────────────────────────────────────────────────

function MessagesArea({ conv, onOpenConversation }: { conv: Conversation; onOpenConversation?: (jid: string) => void }) {
  const [messages, setMessages]       = useState<Message[]>([])
  const [loading, setLoading]         = useState(true)
  const [text, setText]               = useState("")
  const [quickReplies, setQuickReplies]           = useState<{ id: number; keyword: string; message: string }[]>([])
  const [quickRepliesPopup, setQuickRepliesPopup] = useState(false)
  const [qrFilter, setQrFilter]                   = useState("")
  const [sending, setSending]         = useState(false)
  const [sugestao, setSugestao]       = useState<string | null>(null)
  const [sugestaoLoading, setSugestaoLoading] = useState(false)
  const [autoSuggest, setAutoSuggest] = useState(false)
  const [agenteNome, setAgenteNome]   = useState<string | null>(null)
  const [refinamentoOpen, setRefinamentoOpen] = useState(false)
  const [attachment, setAttachment]     = useState<ImageAttachment | null>(null)
  const [sendImgError, setSendImgError] = useState<string | null>(null)
  const [stickerAttachment, setStickerAttachment] = useState<{ dataUrl: string; base64: string } | null>(null)
  const [sendStickerError, setSendStickerError]   = useState<string | null>(null)
  const [replyTo, setReplyTo]         = useState<Message | null>(null)
  const [forwardMsg, setForwardMsg]   = useState<Message | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [sendingSt, setSendingSt]                  = useState(false)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const stickerInputRef = useRef<HTMLInputElement>(null)
  const prevLen      = useRef(0)
  const lastMsgId    = useRef<string | null>(null)
  const deletedIds   = useRef<Set<string>>(new Set())

  // Carrega quick replies da instância
  useEffect(() => {
    fetch(`/api/chat/quick-replies?instance=${encodeURIComponent(conv.instance)}`)
      .then(r => r.json())
      .then((d: { quickReplies?: { id: number; keyword: string; message: string }[] }) =>
        setQuickReplies(d.quickReplies ?? []))
      .catch(() => {})
  }, [conv.instance])

  const loadMessages = useCallback(async () => {
    try {
      const res  = await fetch(`/api/chat/messages/${encodeURIComponent(conv.jid)}?limit=50`)
      const data = await res.json() as { messages: Message[] }
      if (Array.isArray(data.messages))
        setMessages(data.messages.filter(m => !deletedIds.current.has(m.id)))
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [conv.jid])

  // Gera sugestão quando a última mensagem for do cliente
  const gerarSugestao = useCallback(async (msgs: Message[], forcar = false) => {
    if (msgs.length === 0) return
    const ultima = msgs[msgs.length - 1]
    // Só gera se a última mensagem for do cliente e for nova (a não ser que seja forçado)
    if (!forcar && (ultima.from_me || ultima.id === lastMsgId.current)) return
    if (!forcar) lastMsgId.current = ultima.id
    setSugestaoLoading(true)
    setSugestao(null)
    try {
      const res = await fetch("/api/chat/sugestao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid: conv.jid, instance: conv.instance, forcar }),
      })
      const data = await res.json() as { sugestao?: string; agente_nome?: string; motivo?: string }
      if (data.sugestao) {
        setSugestao(data.sugestao)
        setAgenteNome(data.agente_nome ?? null)
      }
    } catch { /* silencioso */ }
    finally { setSugestaoLoading(false) }
  }, [conv.jid, conv.instance])

  useEffect(() => {
    setLoading(true); setMessages([]); setSugestao(null); lastMsgId.current = null
    loadMessages()
  }, [conv.jid, loadMessages])

  useEffect(() => {
    if (messages.length > prevLen.current) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length === prevLen.current + 1 ? "smooth" : "auto" })
      if (autoSuggest) gerarSugestao(messages)
    }
    prevLen.current = messages.length
  }, [messages, autoSuggest, gerarSugestao])

  useEffect(() => {
    let es: EventSource | null = null
    let retries = 0
    let fallback: ReturnType<typeof setInterval> | null = null

    function connect() {
      es = new EventSource(`/api/chat/sse?jid=${encodeURIComponent(conv.jid)}`)

      es.addEventListener("new_message", (e) => {
        const msg = JSON.parse((e as MessageEvent).data) as Message
        if (!deletedIds.current.has(msg.id))
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })

      es.addEventListener("ping", () => { retries = 0 })

      es.onerror = () => {
        es?.close()
        retries++
        if (retries >= 3) {
          if (!fallback) fallback = setInterval(loadMessages, 10_000)
        } else {
          setTimeout(connect, 3_000)
        }
      }
    }

    connect()
    return () => { es?.close(); if (fallback) clearInterval(fallback) }
  }, [conv.jid, loadMessages])

  function enterSelectionMode(msg: Message) {
    setSelectionMode(true)
    setSelectedIds(new Set([msg.id]))
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function cancelSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function deleteSelected() {
    const toDelete = messages.filter(m => selectedIds.has(m.id))
    cancelSelection()
    toDelete.forEach(m => deletedIds.current.add(m.id))
    setMessages(prev => prev.filter(m => !selectedIds.has(m.id)))
    await Promise.all(toDelete.map(m =>
      fetch("/api/chat/delete-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: conv.instance, jid: conv.jid, messageId: m.id, fromMe: m.from_me }),
      }).catch(() => {})
    ))
  }

  async function enviar(conteudo: string, ehSugestao: boolean) {
    if (!conteudo.trim() || sending) return
    const agenteIdRes = ehSugestao ? null : await buscarAgenteId()

    const replyRef = replyTo
    setSending(true); setText(""); setSugestao(null); setReplyTo(null)
    const tempMsg: Message = {
      id: `temp_${Date.now()}`, jid: conv.jid, from_me: true,
      message_type: replyRef ? "extendedTextMessage" : "conversation", content: conteudo,
      media_url: null, status: "PENDING", timestamp: new Date().toISOString(),
      // Injeta contextInfo para o bloco de citação aparecer imediatamente no balão
      raw: replyRef ? {
        message: {
          extendedTextMessage: {
            text: conteudo,
            contextInfo: {
              stanzaId: replyRef.id,
              participant: replyRef.from_me ? conv.jid : conv.jid,
              quotedMessage: { conversation: replyRef.content ?? "" },
              _quotedSenderName: replyRef.from_me ? "Você" : (replyRef.jid ? formatJid(replyRef.jid) : ""),
            },
          },
        },
      } : undefined,
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const senderName = replyRef ? (replyRef.from_me ? "Você" : formatJid(replyRef.jid)) : undefined
      const body: Record<string, unknown> = { jid: conv.jid, text: conteudo, instance: conv.instance }
      if (replyRef) {
        body.quoted = {
          key: { remoteJid: conv.jid, fromMe: replyRef.from_me, id: replyRef.id },
          message: { conversation: replyRef.content ?? "" },
        }
        body.quotedSenderName = senderName
      }
      await fetch("/api/chat/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      // Registra aprendizado se você digitou algo diferente da sugestão
      if (!ehSugestao && sugestao && sugestao !== conteudo && agenteIdRes) {
        fetch("/api/chat/aprendizado", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agente_id: agenteIdRes,
            jid: conv.jid,
            instance: conv.instance,
            sugestao_ia: sugestao,
            resposta_real: conteudo,
          }),
        }).catch(() => {})
      }

      await loadMessages()
    } catch { /* silencioso */ }
    finally { setSending(false) }
  }

  async function buscarAgenteId(): Promise<number | null> {
    try {
      const res = await fetch("/api/chat/sugestao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid: conv.jid, instance: conv.instance, apenas_id: true }),
      })
      const data = await res.json() as { agente_id?: number }
      return data.agente_id ?? null
    } catch { return null }
  }

  async function handleSend() {
    // Campo vazio → envia sugestão; com texto → envia o texto
    if (!text.trim() && sugestao) {
      await enviar(sugestao, true)
    } else if (text.trim()) {
      await enviar(text.trim(), false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (quickRepliesPopup) {
      if (e.key === "Escape") { e.preventDefault(); setQuickRepliesPopup(false); return }
      if (e.key === "Enter") {
        const match = quickReplies.filter(r => r.keyword.startsWith(qrFilter.toLowerCase()))
        if (match.length > 0) { e.preventDefault(); applyQuickReply(match[0]); return }
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function applyQuickReply(qr: { keyword: string; message: string }) {
    setText(qr.message)
    setQuickRepliesPopup(false)
    setQrFilter("")
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleTextChange(val: string) {
    setText(val)
    if (val.startsWith("/")) {
      const filter = val.slice(1).toLowerCase()
      setQrFilter(filter)
      setQuickRepliesPopup(true)
    } else {
      setQuickRepliesPopup(false)
      setQrFilter("")
    }
  }

  const handleFileSelected = useCallback(async (file: File) => {
    try {
      const att = await fileToAttachment(file)
      setSendImgError(null)
      setAttachment(att)
    } catch (e) {
      setSendImgError(String(e))
    }
  }, [])

  const enviarImagem = useCallback(async (att: ImageAttachment, caption: string) => {
    if (sending) return
    setSending(true); setAttachment(null); setSendImgError(null)
    const tempId = `temp_${Date.now()}`
    const tempMsg: Message = {
      id: tempId, jid: conv.jid, from_me: true,
      message_type: "imageMessage", content: caption || null,
      media_url: att.dataUrl, status: "PENDING", timestamp: new Date().toISOString(),
      raw: { message: { imageMessage: { url: att.dataUrl } } },
    }
    setMessages(prev => [...prev, tempMsg])
    try {
      const res = await fetch("/api/chat/send-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: conv.instance, jid: conv.jid, imageBase64: att.base64, mimetype: att.mimetype, caption }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setSendImgError(data.error ?? "Falha ao enviar imagem")
        setAttachment(att)
        setMessages(prev => prev.filter(m => m.id !== tempId))
      } else {
        await loadMessages()
      }
    } catch (e) {
      setSendImgError(String(e))
      setAttachment(att)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }, [sending, conv.instance, conv.jid, loadMessages])

  const handleStickerSelected = useCallback((file: File) => {
    if (file.type !== "image/webp") {
      setSendStickerError("Apenas arquivos WebP são suportados")
      return
    }
    if (file.size > 500 * 1024) {
      setSendStickerError("Sticker deve ter no máximo 500 KB")
      return
    }
    setSendStickerError(null)
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target!.result as string
      const base64  = dataUrl.split(",")[1]
      setStickerAttachment({ dataUrl, base64 })
    }
    reader.readAsDataURL(file)
  }, [])

  const enviarSticker = useCallback(async () => {
    if (!stickerAttachment || sendingSt) return
    setSendingSt(true); setSendStickerError(null)
    const tempId = `temp_${Date.now()}`
    const tempMsg: Message = {
      id: tempId, jid: conv.jid, from_me: true,
      message_type: "stickerMessage", content: null,
      media_url: null, status: "PENDING", timestamp: new Date().toISOString(),
      raw: { mediaUrl: stickerAttachment.dataUrl },
    }
    setMessages(prev => [...prev, tempMsg])
    try {
      const res = await fetch("/api/chat/send-sticker", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance: conv.instance, jid: conv.jid, stickerBase64: stickerAttachment.base64 }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setSendStickerError(data.error ?? "Falha ao enviar sticker")
        setMessages(prev => prev.filter(m => m.id !== tempId))
      } else {
        setStickerAttachment(null)
        await loadMessages()
      }
    } catch (e) {
      setSendStickerError(String(e))
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSendingSt(false)
    }
  }, [stickerAttachment, sendingSt, conv.instance, conv.jid, loadMessages])

  // Colar imagem com Ctrl+V
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imgItem = items.find(i => i.type.startsWith("image/"))
      if (!imgItem) return
      e.preventDefault()
      const file = imgItem.getAsFile()
      if (file) await handleFileSelected(file)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [handleFileSelected])

  const botaoAtivo = text.trim() || sugestao

  let lastDate = ""

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* Header */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "#f0f2f5" }}>
        <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={conv.profile_pic_url} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{conv.profile_name ?? formatJid(conv.jid)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>+{formatJid(conv.jid)}</div>
        </div>
        {conv.shadow_mode && agenteNome && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#7c3aed22", color: "#7c3aed", fontWeight: 600, border: "1px solid #7c3aed33" }}>
            ◆ {agenteNome}
          </span>
        )}
      </div>

      {/* Toolbar de seleção múltipla */}
      {selectionMode && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "#1e3a5f", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={cancelSelection} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.size === 0}
            style={{ background: selectedIds.size > 0 ? "#ef4444" : "#6b7280", border: "none", color: "#fff", cursor: selectedIds.size > 0 ? "pointer" : "default", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600 }}
          >
            Apagar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </button>
        </div>
      )}

      {/* Mensagens */}
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
              <MessageBubble
                msg={msg}
                instance={conv.instance}
                isGroup={conv.jid.endsWith("@g.us")}
                onReply={setReplyTo}
                onForward={setForwardMsg}
                onDelete={enterSelectionMode}
                selectionMode={selectionMode}
                selected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelect}
                onOpenConversation={onOpenConversation}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Modal de encaminhar */}
      {forwardMsg && (
        <ForwardModal msg={forwardMsg} instance={conv.instance} onClose={() => setForwardMsg(null)} />
      )}

      {/* Área de input com modo sombra */}
      <div style={{ background: "#f0f2f5", borderTop: "1px solid var(--border)" }}>

        {/* Barra de resposta */}
        {replyTo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 2px", borderLeft: "3px solid #2563eb", marginLeft: 12, marginRight: 12, marginTop: 6, background: "#eff6ff", borderRadius: "0 6px 6px 0" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 600, marginBottom: 1 }}>
                {replyTo.from_me ? "Você" : formatJid(replyTo.jid)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {replyTo.content ?? "[mídia]"}
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
        )}

        {/* Campo de sugestão do agente */}
        {(sugestao || sugestaoLoading) && (
          <div style={{ padding: "8px 12px 4px", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: 16, padding: "8px 14px", border: "1px solid #e9d5ff", minHeight: 36, position: "relative" }}>
              <div style={{ fontSize: 9, color: "#7c3aed", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 3 }}>
                ◆ SUGESTÃO DO AGENTE {agenteNome ? `· ${agenteNome}` : ""}
              </div>
              {sugestaoLoading ? (
                <div style={{ fontSize: 12, color: "#c4b5fd", fontStyle: "italic" }}>Gerando sugestão...</div>
              ) : (
                <div
                  onClick={() => sugestao && setText(sugestao)}
                  style={{ fontSize: 13, color: "#6d28d9", lineHeight: 1.5, cursor: "pointer", fontStyle: "italic" }}
                  title="Clique para editar no campo de texto"
                >
                  {sugestao}
                </div>
              )}
            </div>
            {/* Botão recarregar sugestão */}
            <button
              onClick={() => gerarSugestao(messages, true)}
              disabled={sugestaoLoading}
              title="Gerar nova sugestão"
              style={{ width: 28, height: 28, borderRadius: "50%", background: "#ede9fe", border: "1px solid #e9d5ff", color: "#7c3aed", fontSize: 12, cursor: "pointer", flexShrink: 0, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              ↺
            </button>
            {sugestao && (
              <button onClick={() => setSugestao(null)}
                style={{ width: 28, height: 28, borderRadius: "50%", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", flexShrink: 0, marginTop: 4 }}>
                ✕
              </button>
            )}
          </div>
        )}

        {/* Botões de agente */}
        <div style={{ padding: "4px 12px 0", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
          {!sugestao && !sugestaoLoading && (
            <>
              <button
                onClick={() => gerarSugestao(messages, true)}
                title="Pedir sugestão do agente"
                style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: "#ede9fe", border: "1px solid #e9d5ff", color: "#7c3aed", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                ◆ sugerir resposta
              </button>
              <button
                onClick={() => setRefinamentoOpen(true)}
                title="Conversar com o agente sobre esta conversa"
                style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                ◇ refinar agente
              </button>
            </>
          )}
          <button
            onClick={() => setAutoSuggest(p => !p)}
            title={autoSuggest ? "Desativar sugestão automática" : "Ativar sugestão automática"}
            style={{ fontSize: 10, padding: "3px 10px", borderRadius: 99, background: autoSuggest ? "#7c3aed" : "#f3f4f6", border: `1px solid ${autoSuggest ? "#6d28d9" : "#e5e7eb"}`, color: autoSuggest ? "#fff" : "#9ca3af", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            {autoSuggest ? "◆ auto" : "◇ auto"}
          </button>
        </div>

        {/* Modal de refinamento do agente */}
        {refinamentoOpen && (
          <AgenteRefinamentoModal conv={conv} onClose={() => setRefinamentoOpen(false)} />
        )}

        {/* Preview de imagem pré-envio */}
        {attachment && (
          <ImagePreview
            attachment={attachment}
            onSend={enviarImagem}
            onCancel={() => { setAttachment(null); setSendImgError(null) }}
            onReplace={setAttachment}
          />
        )}

        {/* Toast de erro de envio de imagem */}
        {sendImgError && !attachment && (
          <div style={{ padding: "4px 16px 0", fontSize: 11, color: "#dc2626" }}>
            {sendImgError}
          </div>
        )}

        {/* Preview de sticker pré-envio */}
        {stickerAttachment && (
          <StickerPreview
            dataUrl={stickerAttachment.dataUrl}
            base64={stickerAttachment.base64}
            onSend={enviarSticker}
            onCancel={() => { setStickerAttachment(null); setSendStickerError(null) }}
            sending={sendingSt}
            error={sendStickerError}
          />
        )}

        {/* Toast de erro de sticker sem preview ativo */}
        {sendStickerError && !stickerAttachment && (
          <div style={{ padding: "4px 16px 0", fontSize: 11, color: "#dc2626" }}>
            {sendStickerError}
          </div>
        )}

        {/* Input file oculto — imagens */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = "" }}
        />

        {/* Input file oculto — sticker WebP */}
        <input
          ref={stickerInputRef}
          type="file"
          accept=".webp,image/webp"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleStickerSelected(f); e.target.value = "" }}
        />

        {/* Popup de respostas rápidas */}
        {quickRepliesPopup && (() => {
          const filtered = quickReplies.filter(r => r.keyword.startsWith(qrFilter))
          if (filtered.length === 0) return null
          return (
            <div style={{ margin: "0 12px 4px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 -4px 16px rgba(0,0,0,0.08)", overflow: "hidden" }}>
              <div style={{ padding: "6px 12px 4px", fontSize: 10, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.08em", borderBottom: "1px solid #f3f4f6" }}>RESPOSTAS RÁPIDAS</div>
              {filtered.map(qr => (
                <button
                  key={qr.id}
                  onClick={() => applyQuickReply(qr)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f9fafb" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "1px 8px", fontFamily: "monospace", flexShrink: 0 }}>/{qr.keyword}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{qr.message}</span>
                </button>
              ))}
            </div>
          )
        })()}

        {/* Input principal */}
        <div style={{ padding: "8px 12px 10px", display: "flex", alignItems: "flex-end", gap: 8 }}>
          {/* Botão de anexo — imagem */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Enviar imagem"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: "1px solid #d1d5db", color: "#64748b", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
            📎
          </button>
          {/* Botão de sticker */}
          <button
            onClick={() => stickerInputRef.current?.click()}
            title="Enviar sticker (WebP)"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: "1px solid #d1d5db", color: "#64748b", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
            🗒️
          </button>
          <textarea
            ref={inputRef} value={text}
            onChange={e => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sugestao ? "Digite para substituir a sugestão, ou Enter para enviar..." : "Digite uma mensagem..."}
            rows={1}
            style={{ flex: 1, resize: "none", borderRadius: 24, padding: "10px 16px", fontSize: 13, background: "#fff", border: "none", maxHeight: 120, lineHeight: 1.5, overflowY: "auto", outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
            onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px" }}
          />
          <button onClick={handleSend} disabled={!botaoAtivo || sending}
            style={{ width: 42, height: 42, borderRadius: "50%", background: botaoAtivo ? "#16a34a" : "#ccc", border: "none", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}>
            ➤
          </button>
        </div>

        {/* Dica modo sombra */}
        {sugestao && !text.trim() && (
          <div style={{ fontSize: 10, color: "#7c3aed", textAlign: "center", paddingBottom: 6, opacity: 0.7 }}>
            Enter envia a sugestão · Clique nela para editar
          </div>
        )}
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
  const [settingsOpen, setSettingsOpen]         = useState(false)
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false)

  const onGroupNameResolved = useCallback((jid: string, name: string) => {
    setConversations(prev => prev.map(c => c.jid === jid ? { ...c, profile_name: name } : c))
    setSelected(prev => prev?.jid === jid ? { ...prev, profile_name: name } : prev)
  }, [])

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

    let es: EventSource | null = null
    let retries = 0
    let fallback: ReturnType<typeof setInterval> | null = null

    function connect() {
      es = new EventSource("/api/chat/sse?jid=*")

      es.addEventListener("conversation_update", (e) => {
        const { jid, last_message, last_message_at, unread_count_delta } =
          JSON.parse((e as MessageEvent).data) as {
            jid: string
            last_message: string | null
            last_message_at: string
            unread_count_delta: number
          }
        setConversations(prev => prev.map(c =>
          c.jid !== jid ? c : {
            ...c,
            last_message,
            last_message_at,
            unread_count: unread_count_delta > 0
              ? c.unread_count + unread_count_delta
              : c.unread_count,
          }
        ))
      })

      es.addEventListener("ping", () => { retries = 0 })

      es.onerror = () => {
        es?.close()
        retries++
        if (retries >= 3) {
          if (!fallback) fallback = setInterval(loadConversations, 30_000)
        } else {
          setTimeout(connect, 3_000)
        }
      }
    }

    connect()
    return () => { es?.close(); if (fallback) clearInterval(fallback) }
  }, [loadConversations])

  // Abre conversa por JID (usado pelo botão de indicação)
  function openByJid(jid: string) {
    const found = conversations.find(c => c.jid === jid)
    if (found) { setSelected(found); return }
    // Cria entrada temporária se não existir ainda na lista
    setSelected({ jid, instance: "jsevolution", profile_name: null, profile_pic_url: null, last_message: null, last_message_at: null, unread_count: 0, is_client: null, shadow_mode: true, muted: false, pinned: false })
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return (c.profile_name ?? "").toLowerCase().includes(q) || c.jid.includes(q)
  })

  function handlePinToggled(jid: string, pinned: boolean) {
    setConversations(prev => {
      const updated = prev.map(c => c.jid === jid ? { ...c, pinned } : c)
      // re-sort: pinned first, then by last_message_at desc
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return tb - ta
      })
    })
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* Lista */}
      <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", background: "#f0f2f5" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1d23" }}>Conversas</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
              <ImportButton onImported={loadConversations} />
              {/* Botão de configurações */}
              <button
                onClick={() => setSettingsOpen(p => !p)}
                title="Configurações"
                style={{ width: 28, height: 28, borderRadius: "50%", background: settingsOpen ? "#e2e8f0" : "transparent", border: "1px solid var(--border)", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}
              >
                ⚙️
              </button>
              {/* Menu de configurações */}
              {settingsOpen && (
                <div
                  style={{ position: "absolute", top: 34, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 200, zIndex: 300, overflow: "hidden" }}
                  onMouseLeave={() => setSettingsOpen(false)}
                >
                  <div style={{ padding: "6px 14px 4px", fontSize: 10, color: "#9ca3af", fontWeight: 700, letterSpacing: "0.08em" }}>CONFIGURAÇÕES</div>
                  <button
                    onClick={() => { setSettingsOpen(false); setQuickRepliesOpen(true) }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#1a1d23", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span>⚡</span> Respostas Rápidas
                  </button>
                </div>
              )}
            </div>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar..." style={{ width: "100%", padding: "8px 12px", borderRadius: 24, fontSize: 13, background: "#fff", border: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Carregando...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>{search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}</div>}
          {filtered.map(conv => (
            <ConversationItem key={conv.jid} conv={conv} active={selected?.jid === conv.jid} onClick={() => setSelected(conv)} onPinToggled={handlePinToggled} />
          ))}
        </div>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selected ? (
          <MessagesArea key={selected.jid} conv={selected} onOpenConversation={openByJid} />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12, background: "#e5ddd5" }}>
            <div style={{ fontSize: 48, opacity: 0.4 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>JS Lab Chat</div>
            <div style={{ fontSize: 13 }}>Selecione uma conversa para começar</div>
          </div>
        )}
      </div>

      {/* Modal de respostas rápidas */}
      {quickRepliesOpen && (
        <QuickRepliesModal
          instance={selected?.instance ?? conversations[0]?.instance ?? "jsevolution"}
          onClose={() => setQuickRepliesOpen(false)}
        />
      )}

      {/* Coluna direita */}
      {selected && (
        selected.jid.endsWith("@g.us")
          ? <GroupPanel key={selected.jid} conv={selected} onGroupNameResolved={onGroupNameResolved} />
          : <ContactPanel key={selected.jid} conv={selected} onOpenConversation={openByJid} />
      )}
    </div>
  )
}