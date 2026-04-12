"use client"

import { useEffect, useRef, useState, useCallback } from "react"

interface Props {
  src: string
  caption?: string | null
  onClose: () => void
}

export default function ImageLightbox({ src, caption, onClose }: Props) {
  const [scale, setScale]       = useState(1)
  const [offset, setOffset]     = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [visible, setVisible]   = useState(false)
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const imgRef    = useRef<HTMLImageElement>(null)

  // Fade-in ao montar
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  // Fechar com Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() {
    setVisible(false)
    setTimeout(onClose, 180)
  }

  // Zoom com scroll
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setScale(s => Math.min(4, Math.max(0.5, s - e.deltaY * 0.001)))
  }, [])

  // Pan com drag
  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.mx,
      y: dragStart.current.oy + e.clientY - dragStart.current.my,
    })
  }
  function onMouseUp() { setDragging(false); dragStart.current = null }

  // Download
  function download() {
    const a = document.createElement("a")
    a.href = src
    a.download = "imagem"
    a.target = "_blank"
    a.click()
  }

  return (
    <div
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: `rgba(0,0,0,${visible ? 0.92 : 0})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        transition: "background 0.18s",
        userSelect: "none",
      }}
      onClick={close}
    >
      {/* Botões superiores */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: "absolute", top: 12, right: 16, display: "flex", gap: 8, zIndex: 10 }}
      >
        <button onClick={download} title="Download" style={btnStyle}>⬇</button>
        <button onClick={close}    title="Fechar"   style={btnStyle}>✕</button>
      </div>

      {/* Imagem */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        draggable={false}
        onClick={e => e.stopPropagation()}
        onMouseDown={onMouseDown}
        style={{
          maxWidth: "90vw", maxHeight: caption ? "80vh" : "90vh",
          objectFit: "contain", borderRadius: 6,
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transitionProperty: dragging ? "none" : "transform, opacity",
          transitionDuration: "0.15s",
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Caption */}
      {caption && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 12, fontSize: 13, color: "#e2e8f0",
            maxWidth: "80vw", textAlign: "center",
            opacity: visible ? 1 : 0, transition: "opacity 0.18s",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%",
  background: "rgba(255,255,255,0.15)", border: "none",
  color: "#fff", fontSize: 14, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(4px)",
}
