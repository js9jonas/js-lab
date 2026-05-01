"use client"

import { useState, useEffect, useRef } from "react"

interface Props {
  value: string
  onChange: (v: string) => void
  lang?: string
  size?: number
}

export default function VoiceInputButton({ value, onChange, lang = "pt-BR", size = 36 }: Props) {
  const [listening, setListening] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const recognitionRef            = useRef<any>(null)
  const committedRef              = useRef("")

  useEffect(() => () => { recognitionRef.current?.abort() }, [])

  function start() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      alert("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.")
      return
    }

    const rec = new SR()
    rec.lang           = lang
    rec.continuous     = true
    rec.interimResults = true

    committedRef.current = value === "" || value.endsWith(" ") ? value : value + " "

    rec.onstart      = () => setListening(true)
    rec.onsoundstart = () => setDetecting(true)
    rec.onsoundend   = () => setDetecting(false)

    rec.onresult = (e: any) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const t = (r[0].transcript as string).trim()
        if (r.isFinal) {
          committedRef.current += t + " "
        } else {
          interim = t
        }
      }
      onChange(committedRef.current + interim)
    }

    rec.onerror = () => { setListening(false); setDetecting(false) }
    rec.onend   = () => { setListening(false); setDetecting(false) }

    recognitionRef.current = rec
    rec.start()
  }

  function stop() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }

  const fontSize = Math.round(size * 0.42)

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      title={listening ? "Parar gravação" : "Ditar mensagem"}
      className={detecting ? "mic-pulse" : undefined}
      style={{
        width: size, height: size,
        borderRadius: "50%",
        background: listening ? "#dc2626" : "transparent",
        border: `1px solid ${listening ? "#dc2626" : "#d1d5db"}`,
        color: listening ? "#fff" : "#64748b",
        fontSize,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      🎤
    </button>
  )
}
