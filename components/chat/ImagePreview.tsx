"use client"

import { useState } from "react"
import ImageEditor from "./ImageEditor"

const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"]
const MAX_MB  = 16

export interface ImageAttachment {
  base64: string
  mimetype: string
  dataUrl: string
  filename: string
  sizeBytes: number
}

interface Props {
  attachment: ImageAttachment
  onSend: (attachment: ImageAttachment, caption: string) => void
  onCancel: () => void
  onReplace: (attachment: ImageAttachment) => void
}

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED.includes(file.type)) { reject(new Error("Tipo não suportado")); return }
    if (file.size > MAX_MB * 1024 * 1024) { reject(new Error(`Máximo ${MAX_MB} MB`)); return }
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target!.result as string
      const base64  = dataUrl.split(",")[1]
      resolve({ base64, mimetype: file.type, dataUrl, filename: file.name, sizeBytes: file.size })
    }
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"))
    reader.readAsDataURL(file)
  })
}

export default function ImagePreview({ attachment, onSend, onCancel, onReplace }: Props) {
  const [caption, setCaption] = useState("")
  const [editing, setEditing] = useState(false)

  function handleEditorConfirm(newBase64: string) {
    const newDataUrl = `data:${attachment.mimetype};base64,${newBase64}`
    const newSize    = Math.ceil(newBase64.length * 3 / 4)
    onReplace({ ...attachment, base64: newBase64, dataUrl: newDataUrl, sizeBytes: newSize })
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <ImageEditor src={attachment.dataUrl} onConfirm={handleEditorConfirm} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div style={{ padding: "8px 12px", background: "#f0f2f5", borderTop: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>

        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />

        {/* Metadados + caption */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {attachment.filename} · {formatBytes(attachment.sizeBytes)}
          </div>
          <input
            autoFocus
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSend(attachment, caption) }}
            placeholder="Adicionar legenda (opcional)..."
            style={{ fontSize: 12, border: "none", borderBottom: "1px solid #e5e7eb", outline: "none", padding: "3px 0", background: "transparent", color: "#1a1d23", width: "100%" }}
          />
        </div>

        {/* Botões */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <button onClick={() => setEditing(true)}   style={actionBtn("#7c3aed")}>✏️ Editar</button>
          <button onClick={() => onSend(attachment, caption)} style={actionBtn("#16a34a")}>Enviar</button>
          <button onClick={onCancel}                 style={actionBtn("#94a3b8")}>✕</button>
        </div>
      </div>
    </div>
  )
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    fontSize: 11, padding: "4px 10px", borderRadius: 6,
    background: bg, color: "#fff", border: "none", cursor: "pointer",
    fontWeight: 600, whiteSpace: "nowrap",
  }
}
