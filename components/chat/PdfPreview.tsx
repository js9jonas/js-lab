"use client"

import { useState, useCallback } from "react"

interface Props {
  messageId: string
  instance: string
  raw: unknown
  fromMe: boolean
}

type State = "idle" | "loading" | "ready" | "error"

function parseFileSize(fileLength: unknown): string | null {
  if (!fileLength || typeof fileLength !== "object") return null
  const fl = fileLength as { low?: number; high?: number }
  const bytes = (fl.low ?? 0) + (fl.high ?? 0) * 2 ** 32
  if (bytes === 0) return null
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extractDocInfo(raw: unknown): { fileName: string; mimetype: string; fileSize: string | null; pageCount: number | null } {
  const defaults = { fileName: "Documento", mimetype: "application/octet-stream", fileSize: null, pageCount: null }
  try {
    const r = raw as Record<string, unknown>
    const docMsg = (r?.message as Record<string, unknown>)?.documentMessage as Record<string, unknown> | undefined
    if (!docMsg) return defaults
    return {
      fileName:  (docMsg.fileName  as string)  ?? "Documento",
      mimetype:  (docMsg.mimetype  as string)  ?? "application/octet-stream",
      fileSize:  parseFileSize(docMsg.fileLength),
      pageCount: typeof docMsg.pageCount === "number" ? docMsg.pageCount : null,
    }
  } catch { return defaults }
}

function getRawBase64(raw: unknown): string | null {
  try {
    const r = raw as Record<string, unknown>
    const v = r?.mediaUrl
    return typeof v === "string" ? v : null
  } catch { return null }
}

const LARGE_BYTES = 10 * 1024 * 1024 // 10 MB em base64 ≈ ~13 MB real

export default function PdfPreview({ messageId, instance, raw, fromMe }: Props) {
  const { fileName, mimetype, fileSize, pageCount } = extractDocInfo(raw)
  const isPdf = mimetype === "application/pdf"

  const [state, setState]   = useState<State>("idle")
  const [base64, setBase64] = useState<string | null>(getRawBase64(raw))
  const [error, setError]   = useState<string | null>(null)
  const [warnLarge, setWarnLarge] = useState(false)

  const fetchBase64 = useCallback(async () => {
    setState("loading")
    setError(null)
    try {
      const res = await fetch("/api/chat/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance, messageId }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? `Erro ${res.status}`)
      }
      const data = await res.json() as { base64?: string; mimetype?: string }
      if (!data.base64) throw new Error("base64 não retornado")
      setBase64(data.base64)
      setState("ready")
    } catch (err) {
      setError((err as Error).message)
      setState("error")
    }
  }, [instance, messageId])

  const handleVisualize = useCallback(() => {
    // Se já temos o base64 (raw.mediaUrl), abre direto
    if (base64) {
      // Verifica tamanho antes de renderizar no iframe
      const estimatedBytes = Math.ceil(base64.length * 3 / 4)
      if (estimatedBytes > LARGE_BYTES && !warnLarge) {
        setWarnLarge(true)
        return
      }
      setState("ready")
      return
    }
    fetchBase64()
  }, [base64, warnLarge, fetchBase64])

  const handleOpenNewTab = useCallback(() => {
    if (!base64) return
    const byteChars = atob(base64)
    const byteNums  = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const blob    = new Blob([byteNums], { type: mimetype })
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, "_blank")
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  }, [base64, mimetype])

  const handleDownload = useCallback(() => {
    if (!base64) return
    const link = document.createElement("a")
    link.href     = `data:${mimetype};base64,${base64}`
    link.download = fileName
    link.click()
  }, [base64, mimetype, fileName])

  const bubbleBg   = fromMe ? "#dcf8c6" : "#ffffff"
  const cardBorder = fromMe ? "#b7e4a0" : "#e5e7eb"

  // ── Card compacto (idle / error) ────────────────────────────────────────────
  const card = (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: bubbleBg, border: `1px solid ${cardBorder}`,
      borderRadius: 10, padding: "8px 10px", minWidth: 200, maxWidth: 280,
    }}>
      {/* Ícone */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: isPdf ? "#fee2e2" : "#e0e7ff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>
        {isPdf ? "📄" : "📎"}
      </div>

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1d23", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fileName}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
          {[
            isPdf ? "PDF" : mimetype.split("/")[1]?.toUpperCase() ?? "DOC",
            fileSize,
            pageCount != null ? `${pageCount} pág.` : null,
          ].filter(Boolean).join(" · ")}
        </div>
        {error && (
          <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>{error}</div>
        )}
      </div>

      {/* Botões */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        {isPdf && (
          <button onClick={handleVisualize} style={btn("#3b82f6")}>
            {state === "error" ? "Tentar novamente" : "Visualizar"}
          </button>
        )}
        {base64 && (
          <button onClick={handleDownload} style={btn("#64748b")}>Baixar</button>
        )}
      </div>
    </div>
  )

  // ── Aviso arquivo grande ─────────────────────────────────────────────────────
  if (warnLarge && state !== "ready") {
    return (
      <div style={{ maxWidth: 300 }}>
        {card}
        <div style={{ marginTop: 6, fontSize: 11, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "6px 8px" }}>
          Arquivo grande ({fileSize}). Pode demorar para carregar.{" "}
          <button
            onClick={() => { setWarnLarge(false); setState("ready") }}
            style={{ color: "#b45309", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11 }}>
            Visualizar mesmo assim
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div style={{ maxWidth: 300 }}>
        {card}
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
          <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Carregando documento…
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Ready: PDF renderizado ───────────────────────────────────────────────────
  if (state === "ready" && base64 && isPdf) {
    const src = `data:application/pdf;base64,${base64}`
    return (
      <div style={{ maxWidth: 340 }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1d23", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
            📄 {fileName}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleOpenNewTab} style={btn("#7c3aed")}>↗ Nova aba</button>
            <button onClick={handleDownload}   style={btn("#64748b")}>⬇ Baixar</button>
            <button onClick={() => setState("idle")} style={btn("#94a3b8")}>✕</button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          src={src}
          style={{ width: "100%", height: 500, border: "none", borderRadius: 8, display: "block", background: "#f8fafc" }}
          title={fileName}
        />
      </div>
    )
  }

  // ── Fallback: não-PDF ou sem base64 ─────────────────────────────────────────
  return card
}

function btn(bg: string): React.CSSProperties {
  return {
    fontSize: 10, padding: "3px 8px", borderRadius: 5,
    background: bg, color: "#fff", border: "none", cursor: "pointer",
    fontWeight: 600, whiteSpace: "nowrap",
  }
}
