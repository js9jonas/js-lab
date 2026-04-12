"use client"

import { useRef, useState, useEffect, useCallback } from "react"

interface Props {
  messageId: string
  instance: string
  fromMe: boolean
}

// Waveform determinística: seed pelo messageId
function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  return () => {
    h ^= h >>> 13; h ^= h << 17; h ^= h >>> 5
    return (h >>> 0) / 4294967296
  }
}

function buildBars(messageId: string): number[] {
  const rand = seededRandom(messageId)
  return Array.from({ length: 40 }, () => 0.2 + rand() * 0.8)
}

function formatDuration(s: number): string {
  if (!isFinite(s)) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

const SPEEDS = [1, 1.5, 2] as const

export default function AudioPlayer({ messageId, instance, fromMe }: Props) {
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const bars       = useRef(buildBars(messageId))

  const [status, setStatus]     = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [playing, setPlaying]   = useState(false)
  const [progress, setProgress] = useState(0)        // 0–1
  const [current, setCurrent]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIdx, setSpeedIdx] = useState(0)

  const color     = fromMe ? "#00a884" : "#8696a0"
  const bgColor   = fromMe ? "#d9fdd3" : "#f0f2f5"
  const barActive = fromMe ? "#00a884" : "#3b4a54"
  const barInact  = fromMe ? "#92d5be" : "#aebac1"

  // Carrega o áudio lazily na primeira vez que o usuário clica em play
  const load = useCallback(async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/chat/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance, messageId }),
      })
      const data = await res.json() as { base64?: string; mimetype?: string; error?: string }
      if (!res.ok || !data.base64) throw new Error(data.error ?? "Falha ao carregar áudio")

      const src = `data:${data.mimetype ?? "audio/ogg"};base64,${data.base64}`
      const audio = new Audio(src)
      audio.playbackRate = SPEEDS[speedIdx]

      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration))
      audio.addEventListener("timeupdate", () => {
        setCurrent(audio.currentTime)
        setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
      })
      audio.addEventListener("ended", () => { setPlaying(false); setProgress(0); setCurrent(0) })

      audioRef.current = audio
      setStatus("ready")
      audio.play()
      setPlaying(true)
    } catch {
      setStatus("error")
    }
  }, [instance, messageId, speedIdx])

  const togglePlay = useCallback(() => {
    if (status === "idle") { load(); return }
    if (status !== "ready" || !audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else         { audioRef.current.play();  setPlaying(true)  }
  }, [status, playing, load])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || status !== "ready") return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * audioRef.current.duration
    setProgress(ratio)
  }, [status])

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }, [speedIdx])

  // Cleanup ao desmontar
  useEffect(() => () => { audioRef.current?.pause() }, [])

  if (status === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px", minWidth: 160 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Áudio indisponível</span>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", minWidth: 220, background: bgColor, borderRadius: 8 }}>

      {/* Botão play/pause */}
      <button
        onClick={togglePlay}
        style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: color, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}
      >
        {status === "loading" ? (
          <span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
        ) : playing ? "⏸" : "▶"}
      </button>

      {/* Waveform + barra de progresso */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          onClick={seek}
          style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 28, cursor: status === "ready" ? "pointer" : "default" }}
        >
          {bars.current.map((h, i) => {
            const filled = i / bars.current.length < progress
            return (
              <div key={i} style={{ flex: 1, borderRadius: 2, background: filled ? barActive : barInact, height: `${h * 100}%`, transition: "background 0.1s" }} />
            )
          })}
        </div>

        {/* Tempo */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: fromMe ? "#075e54" : "#667781" }}>
          <span>{formatDuration(current)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Velocidade */}
      <button
        onClick={cycleSpeed}
        style={{ fontSize: 10, fontWeight: 700, color: color, background: "transparent", border: `1px solid ${color}`, borderRadius: 4, padding: "2px 5px", cursor: "pointer", flexShrink: 0, lineHeight: 1.4 }}
      >
        {SPEEDS[speedIdx]}x
      </button>

      {/* CSS da animação de loading */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
