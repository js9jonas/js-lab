"use client"

import { useState, useEffect } from "react"

interface Props {
  messageId: string
  instance: string
  raw: unknown
}

type State = "loading" | "ready" | "error"

function getRawBase64(raw: unknown): string | null {
  try {
    const r = raw as Record<string, unknown>
    const v = r?.mediaUrl
    return typeof v === "string" ? v : null
  } catch { return null }
}

export default function StickerBubble({ messageId, instance, raw }: Props) {
  const [state, setState] = useState<State>(() => getRawBase64(raw) ? "ready" : "loading")
  const [src, setSrc]     = useState<string | null>(() => {
    const b64 = getRawBase64(raw)
    return b64 ? b64 : null
  })

  useEffect(() => {
    // Se já temos o base64 no raw, não precisa buscar
    if (src) return

    let cancelled = false
    async function fetchSticker() {
      try {
        const res = await fetch("/api/chat/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance, messageId }),
        })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json() as { base64?: string; mimetype?: string }
        if (!data.base64) throw new Error("base64 não retornado")
        if (cancelled) return
        const mime = data.mimetype ?? "image/webp"
        setSrc(`data:${mime};base64,${data.base64}`)
        setState("ready")
      } catch {
        if (!cancelled) setState("error")
      }
    }

    fetchSticker()
    return () => { cancelled = true }
  }, [messageId, instance, src])

  // Skeleton enquanto carrega
  if (state === "loading") {
    return (
      <div style={{
        width: 120, height: 120, borderRadius: 8,
        background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s infinite",
      }}>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      </div>
    )
  }

  // Placeholder de erro
  if (state === "error" || !src) {
    return (
      <div style={{ width: 120, height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, opacity: 0.5 }}>
        🗒️
      </div>
    )
  }

  // Sticker renderizado
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="sticker"
      style={{ width: 120, height: 120, objectFit: "contain", display: "block" }}
      onError={() => setState("error")}
    />
  )
}
