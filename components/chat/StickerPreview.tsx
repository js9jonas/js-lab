"use client"

interface Props {
  dataUrl: string
  base64: string
  onSend: () => void
  onCancel: () => void
  sending: boolean
  error: string | null
}

export default function StickerPreview({ dataUrl, onSend, onCancel, sending, error }: Props) {
  return (
    <div style={{ padding: "8px 12px", background: "#f0f2f5", borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", maxWidth: 280 }}>

        {/* Sticker preview sem fundo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="sticker"
          style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0, borderRadius: 8 }}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: "#64748b" }}>Sticker</div>

          {error && (
            <div style={{ fontSize: 10, color: "#dc2626" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={onSend}
              disabled={sending}
              style={{
                fontSize: 11, padding: "4px 14px", borderRadius: 6,
                background: sending ? "#86efac" : "#16a34a",
                color: "#fff", border: "none", cursor: sending ? "default" : "pointer",
                fontWeight: 600,
              }}>
              {sending ? "Enviando…" : error ? "Tentar novamente" : "Enviar"}
            </button>
            <button
              onClick={onCancel}
              disabled={sending}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6,
                background: "#94a3b8", color: "#fff", border: "none",
                cursor: sending ? "default" : "pointer", fontWeight: 600,
              }}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
