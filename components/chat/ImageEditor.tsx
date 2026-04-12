"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Props {
  src: string          // data URL ou URL da imagem
  onConfirm: (base64: string) => void
  onCancel: () => void
}

type Tool = "emoji" | "text" | "brush" | "crop"

const COLORS  = ["#ffffff","#000000","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#a855f7"]
const BRUSHES = [2, 4, 8, 16]
const EMOJIS  = ["😀","😂","😍","😎","🤔","😭","🔥","❤️","👍","👎","✅","❌","⭐","🎉","💯","🙏","👀","💪","😱","🤣","😊","🥰","😜","🤯","💀","🤝","👏","🫡","😤","🥹"]

export default function ImageEditor({ src, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [tool, setTool]               = useState<Tool>("brush")
  const [color, setColor]             = useState("#ef4444")
  const [brushSize, setBrushSize]     = useState(4)
  const [emojiSize, setEmojiSize]     = useState(32)
  const [history, setHistory]         = useState<ImageData[]>([])
  const [histIdx, setHistIdx]         = useState(-1)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [selectedEmoji, setSelectedEmoji]     = useState<string | null>(null)
  const [textInput, setTextInput]     = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue]     = useState("")
  const [textSize, setTextSize]       = useState(24)
  const [cropRect, setCropRect]       = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [cropDrag, setCropDrag]       = useState<{ startX: number; startY: number } | null>(null)
  const [canvasError, setCanvasError] = useState(false)

  const drawing   = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  // ── Inicializa canvas ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) { setCanvasError(true); return }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setHistory([snap])
      setHistIdx(0)
    }
    img.onerror = () => setCanvasError(true)
    img.src = src
  }, [src])

  // ── Undo com Ctrl+Z ────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setHistIdx(i => {
      if (i <= 0) return i
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!
      ctx.putImageData(history[i - 1], 0, 0)
      return i - 1
    })
  }, [history])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo])

  function snapshot() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory(h => [...h.slice(0, histIdx + 1), snap].slice(-10))
    setHistIdx(i => Math.min(i + 1, 9))
  }

  // ── Coordenadas relativas ao canvas ───────────────────────────────────────
  function relCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect   = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width  / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  // ── Handlers de mouse ──────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = relCoords(e)
    const ctx = canvasRef.current!.getContext("2d")!

    if (tool === "brush") {
      snapshot()
      drawing.current = true
      lastPoint.current = pos
      ctx.beginPath(); ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
    }

    if (tool === "emoji" && selectedEmoji) {
      snapshot()
      ctx.font = `${emojiSize}px serif`
      ctx.textBaseline = "middle"; ctx.textAlign = "center"
      ctx.fillText(selectedEmoji, pos.x, pos.y)
    }

    if (tool === "text") {
      setTextInput(pos); setTextValue("")
    }

    if (tool === "crop") {
      setCropRect(null)
      setCropDrag({ startX: pos.x, startY: pos.y })
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = relCoords(e)

    if (tool === "brush" && drawing.current && lastPoint.current) {
      const ctx = canvasRef.current!.getContext("2d")!
      ctx.beginPath()
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = color; ctx.lineWidth = brushSize
      ctx.lineCap = "round"; ctx.lineJoin = "round"
      ctx.stroke()
      lastPoint.current = pos
    }

    if (tool === "crop" && cropDrag) {
      setCropRect({
        x: Math.min(pos.x, cropDrag.startX),
        y: Math.min(pos.y, cropDrag.startY),
        w: Math.abs(pos.x - cropDrag.startX),
        h: Math.abs(pos.y - cropDrag.startY),
      })
    }
  }

  function onMouseUp() {
    drawing.current = false
    lastPoint.current = null
    setCropDrag(null)
  }

  // ── Confirmar texto ────────────────────────────────────────────────────────
  function commitText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); return }
    snapshot()
    const ctx = canvasRef.current!.getContext("2d")!
    ctx.font = `bold ${textSize}px sans-serif`
    ctx.fillStyle = color; ctx.textBaseline = "top"; ctx.textAlign = "left"
    ctx.fillText(textValue, textInput.x, textInput.y)
    setTextInput(null); setTextValue("")
  }

  // ── Aplicar crop ───────────────────────────────────────────────────────────
  function applyCrop() {
    if (!cropRect || cropRect.w < 4 || cropRect.h < 4) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const imgData = ctx.getImageData(
      Math.round(cropRect.x), Math.round(cropRect.y),
      Math.round(cropRect.w), Math.round(cropRect.h)
    )
    canvas.width  = Math.round(cropRect.w)
    canvas.height = Math.round(cropRect.h)
    ctx.putImageData(imgData, 0, 0)
    setCropRect(null)
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory([snap]); setHistIdx(0)
  }

  // ── Confirmar edição ───────────────────────────────────────────────────────
  function confirm() {
    const canvas = canvasRef.current!
    onConfirm(canvas.toDataURL("image/jpeg", 0.92).split(",")[1])
  }

  if (canvasError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 32 }}>
        <span style={{ fontSize: 32 }}>⚠️</span>
        <span style={{ fontSize: 13, color: "#64748b" }}>Não foi possível inicializar o editor.</span>
        <button onClick={onCancel} style={secondaryBtn}>Voltar ao preview</button>
      </div>
    )
  }

  const undoAvailable = histIdx > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "#1e293b", borderRadius: 12, overflow: "hidden", maxWidth: "min(700px, 95vw)", width: "100%" }}>

      {/* Canvas */}
      <div style={{ position: "relative", background: "#0f172a", display: "flex", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            maxWidth: "100%", maxHeight: "55vh", objectFit: "contain", display: "block",
            cursor: tool === "brush" || tool === "crop" ? "crosshair" : "default",
          }}
        />

        {/* Overlay de crop */}
        {tool === "crop" && cropRect && (() => {
          const canvas = canvasRef.current
          if (!canvas) return null
          const rect   = canvas.getBoundingClientRect()
          const scaleX = rect.width  / canvas.width
          const scaleY = rect.height / canvas.height
          return (
            <div style={{
              position: "absolute",
              left: cropRect.x * scaleX, top: cropRect.y * scaleY,
              width: cropRect.w * scaleX, height: cropRect.h * scaleY,
              border: "2px dashed #fff", pointerEvents: "none",
            }} />
          )
        })()}

        {/* Input flutuante de texto */}
        {tool === "text" && textInput && (() => {
          const canvas = canvasRef.current
          if (!canvas) return null
          const rect   = canvas.getBoundingClientRect()
          const scaleX = rect.width  / canvas.width
          const scaleY = rect.height / canvas.height
          return (
            <input
              autoFocus
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null) }}
              onBlur={commitText}
              style={{
                position: "absolute",
                left: textInput.x * scaleX, top: textInput.y * scaleY,
                background: "transparent", border: "1px dashed #fff",
                color, fontSize: textSize * scaleX, fontWeight: 700, fontFamily: "sans-serif",
                outline: "none", padding: "2px 4px", minWidth: 80,
              }}
            />
          )
        })()}
      </div>

      {/* Toolbar */}
      <div style={{ background: "#1e293b", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Seletor de ferramentas */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(["brush","text","emoji","crop"] as Tool[]).map(t => (
            <button key={t}
              onClick={() => { setTool(t); if (t === "emoji") setEmojiPickerOpen(o => !o) }}
              style={{ ...toolBtn, background: tool === t ? "#3b82f6" : "#334155", color: "#fff" }}>
              {t === "brush" ? "✏️ Pincel" : t === "text" ? "T Texto" : t === "emoji" ? "😀 Emoji" : "✂️ Crop"}
            </button>
          ))}
          <button onClick={undo} disabled={!undoAvailable}
            style={{ ...toolBtn, background: undoAvailable ? "#475569" : "#1e293b", color: undoAvailable ? "#fff" : "#475569", marginLeft: "auto" }}>
            ↩ {histIdx > 0 ? histIdx : ""}
          </button>
        </div>

        {/* Opções do pincel */}
        {tool === "brush" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Cor:</span>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
            ))}
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Espessura:</span>
            {BRUSHES.map(b => (
              <button key={b} onClick={() => setBrushSize(b)}
                style={{ ...toolBtn, background: brushSize === b ? "#3b82f6" : "#334155", color: "#fff", padding: "2px 8px" }}>
                {b}px
              </button>
            ))}
          </div>
        )}

        {/* Opções do texto */}
        {tool === "text" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Cor:</span>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
            ))}
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Tamanho: {textSize}px</span>
            <input type="range" min={16} max={48} value={textSize} onChange={e => setTextSize(Number(e.target.value))} style={{ width: 80 }} />
          </div>
        )}

        {/* Picker de emoji */}
        {tool === "emoji" && emojiPickerOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {EMOJIS.map(em => (
                <button key={em} onClick={() => { setSelectedEmoji(em); setEmojiPickerOpen(false) }}
                  style={{ fontSize: 20, background: selectedEmoji === em ? "#334155" : "transparent", border: "none", cursor: "pointer", borderRadius: 4, padding: 2 }}>
                  {em}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Tamanho: {emojiSize}px</span>
              <input type="range" min={16} max={96} value={emojiSize} onChange={e => setEmojiSize(Number(e.target.value))} style={{ width: 100 }} />
            </div>
          </div>
        )}
        {tool === "emoji" && !emojiPickerOpen && selectedEmoji && (
          <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8 }}>
            Emoji: <span style={{ fontSize: 18 }}>{selectedEmoji}</span> — clique na imagem para posicionar.
            <button onClick={() => setEmojiPickerOpen(true)} style={{ ...toolBtn, background: "#334155", color: "#fff" }}>Trocar</button>
          </div>
        )}

        {/* Botão aplicar crop */}
        {tool === "crop" && cropRect && cropRect.w > 4 && cropRect.h > 4 && (
          <button onClick={applyCrop} style={{ ...toolBtn, background: "#16a34a", color: "#fff", alignSelf: "flex-start" }}>
            Aplicar crop ({Math.round(cropRect.w)} × {Math.round(cropRect.h)})
          </button>
        )}

        {/* Confirmar / Cancelar */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #334155", paddingTop: 10 }}>
          <button onClick={onCancel} style={secondaryBtn}>Cancelar</button>
          <button onClick={confirm}  style={primaryBtn}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  fontSize: 11, padding: "4px 10px", borderRadius: 6,
  border: "none", cursor: "pointer", fontWeight: 600,
}
const primaryBtn: React.CSSProperties = {
  fontSize: 12, padding: "7px 18px", borderRadius: 8,
  background: "#16a34a", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600,
}
const secondaryBtn: React.CSSProperties = {
  fontSize: 12, padding: "7px 18px", borderRadius: 8,
  background: "#334155", color: "#cbd5e1", border: "none", cursor: "pointer",
}
