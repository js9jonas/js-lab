"use client"

import { useState, useEffect, useRef, useCallback } from "react"

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJid(jid: string) {
  return jid.replace("@s.whatsapp.net", "").replace("@g.us", "")
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function Avatar({ name, pic, size = 40 }: { name?: string | null; pic?: string | null; size?: number }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?"

  if (pic) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={pic} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  )

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#e2e8f0",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, color: "#64748b", flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

// ─── Item da lista de conversas ───────────────────────────────────────────────

function ConversationItem({
  conv, active, onClick,
}: {
  conv: Conversation
  active: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", cursor: "pointer",
        background: active ? "var(--bg-active)" : "transparent",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "transparent" }}
    >
      <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={conv.profile_pic_url} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontWeight: conv.unread_count > 0 ? 600 : 400, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {conv.profile_name ?? formatJid(conv.jid)}
          </span>
          <span style={{ fontSize: 10, color: conv.unread_count > 0 ? "#16a34a" : "var(--text-muted)", flexShrink: 0 }}>
            {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {conv.last_message ?? "Sem mensagens"}
          </span>
          {conv.unread_count > 0 && (
            <span style={{ background: "#16a34a", color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px", flexShrink: 0 }}>
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

  return (
    <div style={{
      display: "flex",
      justifyContent: isMe ? "flex-end" : "flex-start",
      marginBottom: 4,
      padding: "0 16px",
    }}>
      <div style={{
        maxWidth: "65%",
        background: isMe ? "#dcf8c6" : "#ffffff",
        border: "1px solid",
        borderColor: isMe ? "#b7e4a0" : "var(--border)",
        borderRadius: isMe ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
        padding: "8px 12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}>
        {msg.content && (
          <div style={{ fontSize: 13, color: "#1a1d23", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {msg.content}
          </div>
        )}
        {!msg.content && msg.message_type !== "conversation" && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
            {msg.message_type === "imageMessage" ? "🖼 Imagem" :
             msg.message_type === "audioMessage" ? "🎵 Áudio" :
             msg.message_type === "videoMessage" ? "🎬 Vídeo" :
             msg.message_type === "documentMessage" ? "📄 Documento" :
             msg.message_type === "stickerMessage" ? "🪄 Sticker" :
             `📎 ${msg.message_type}`}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{formatMsgTime(msg.timestamp)}</span>
          {isMe && (
            <span style={{ fontSize: 11, color: msg.status === "READ" ? "#3b82f6" : "#94a3b8" }}>
              {msg.status === "READ" ? "✓✓" : msg.status === "DELIVERED" ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Separador de data ────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 24px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-base)", padding: "2px 10px", borderRadius: 99, border: "1px solid var(--border)" }}>
        {new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  )
}

// ─── Área de mensagens ────────────────────────────────────────────────────────

function MessagesArea({ conv }: { conv: Conversation }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Carrega mensagens
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(conv.jid)}?limit=50`)
      const data = await res.json() as { messages: Message[] }
      if (Array.isArray(data.messages)) setMessages(data.messages)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [conv.jid])

  useEffect(() => {
    setLoading(true)
    setMessages([])
    loadMessages()
  }, [conv.jid, loadMessages])

  // Scroll para o fim ao carregar
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [loading, messages.length])

  // Polling de novas mensagens a cada 3s
  useEffect(() => {
    const t = setInterval(loadMessages, 3000)
    return () => clearInterval(t)
  }, [loadMessages])

  async function handleSend() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setText("")

    // Otimistic: adiciona mensagem localmente imediatamente
    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      jid: conv.jid,
      from_me: true,
      message_type: "conversation",
      content: t,
      media_url: null,
      status: "PENDING",
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid: conv.jid, text: t }),
      })
      await loadMessages() // recarrega para ter o ID real
    } catch { /* silencioso */ }
    finally { setSending(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Agrupa mensagens por data
  let lastDate = ""

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* Header da conversa */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "var(--bg-surface)" }}>
        <Avatar name={conv.profile_name ?? formatJid(conv.jid)} pic={conv.profile_pic_url} size={38} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{conv.profile_name ?? formatJid(conv.jid)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>{formatJid(conv.jid)}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {conv.shadow_mode && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "#7c3aed22", color: "#7c3aed", fontWeight: 600, border: "1px solid #7c3aed33" }}>
              ◆ sombra
            </span>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", background: "#f0f2f5" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
            Carregando mensagens...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
            Nenhuma mensagem ainda.
          </div>
        )}

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

      {/* Input de envio */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-surface)", display: "flex", alignItems: "flex-end", gap: 10 }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para quebrar linha)"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            borderRadius: 24,
            padding: "10px 16px",
            fontSize: 13,
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            maxHeight: 120,
            lineHeight: 1.5,
            overflowY: "auto",
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = "auto"
            el.style.height = Math.min(el.scrollHeight, 120) + "px"
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: text.trim() ? "#16a34a" : "var(--bg-elevated)",
            border: "none", color: text.trim() ? "#fff" : "var(--text-muted)",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.15s",
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected]   = useState<Conversation | null>(null)
  const [search, setSearch]       = useState("")
  const [loading, setLoading]     = useState(true)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations")
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

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return (
      (c.profile_name ?? "").toLowerCase().includes(q) ||
      c.jid.includes(q)
    )
  })

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Coluna esquerda: lista de conversas ── */}
      <div style={{ width: 320, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Conversas</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 24, fontSize: 13, background: "var(--bg-base)" }}
          />
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              Carregando...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              {search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda.\nAs mensagens aparecem aqui conforme chegam."}
            </div>
          )}
          {filtered.map(conv => (
            <ConversationItem
              key={conv.jid}
              conv={conv}
              active={selected?.jid === conv.jid}
              onClick={() => setSelected(conv)}
            />
          ))}
        </div>
      </div>

      {/* ── Centro: área de mensagens ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selected ? (
          <MessagesArea key={selected.jid} conv={selected} />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>JS Lab Chat</div>
            <div style={{ fontSize: 13 }}>Selecione uma conversa para começar</div>
          </div>
        )}
      </div>

    </div>
  )
}
