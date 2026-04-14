"use client"

import { useState } from "react"

interface Props {
  messageId: string
  jid: string
  instance: string
  fromMe: boolean
}

export default function TranscribeButton({ messageId, jid, instance, fromMe }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(false)

  async function handleClick() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/chat/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, jid, instance }),
      })
      if (!res.ok) setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const color = fromMe ? "#075e54" : "#667781"

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Transcrever áudio"
      style={{
        display: "flex", alignItems: "center", gap: 4,
        background: "transparent", border: "none", cursor: loading ? "default" : "pointer",
        padding: "2px 8px 4px", color, fontSize: 11, opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <>
          <span style={{ width: 10, height: 10, border: `1.5px solid ${color}`, borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
          Transcrevendo…
        </>
      ) : error ? (
        "⚠ Tentar novamente"
      ) : (
        "🎙 Transcrever"
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </button>
  )
}
