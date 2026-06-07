"use client"

import { useEffect, useRef, useState } from "react"

type Status =
  | { type: "idle" }
  | { type: "waiting" }
  | { type: "processing" }
  | { type: "success"; phoneNumberId: string; wabaId: string }
  | { type: "error"; message: string }

declare global {
  interface Window {
    FB: {
      init: (opts: object) => void
      login: (cb: (res: { authResponse?: { code: string } }) => void, opts: object) => void
    }
    fbAsyncInit: () => void
  }
}

export default function CoExPage() {
  const [status, setStatus] = useState<Status>({ type: "idle" })
  const fbLoaded = useRef(false)

  useEffect(() => {
    if (fbLoaded.current) return
    fbLoaded.current = true

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: "1060517628167041",
        version: "v21.0",
      })
    }

    const script = document.createElement("script")
    script.src = "https://connect.facebook.net/en_US/sdk.js"
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  async function handleActivate() {
    setStatus({ type: "waiting" })

    window.FB.login(
      async (res) => {
        if (!res.authResponse?.code) {
          setStatus({ type: "error", message: "Login cancelado ou sem código retornado." })
          return
        }

        setStatus({ type: "processing" })

        try {
          const r = await fetch("/api/coex/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: res.authResponse.code }),
          })
          const data = await r.json()

          if (!r.ok) {
            setStatus({ type: "error", message: data.error ?? "Erro desconhecido no servidor." })
            return
          }

          setStatus({
            type: "success",
            phoneNumberId: data.phoneNumberId ?? "(não retornado)",
            wabaId: data.wabaId ?? "(não retornado)",
          })
        } catch (e) {
          setStatus({ type: "error", message: String(e) })
        }
      },
      {
        config_id: "1022901824010896",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      }
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
        Ativar WhatsApp CoEx
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28, lineHeight: 1.6 }}>
        Fluxo de Coexistence via Embedded Signup da Meta. Clique no botão para abrir o popup do
        Facebook e autorizar o número principal no app jswhats.
      </p>

      <button
        onClick={handleActivate}
        disabled={status.type === "waiting" || status.type === "processing" || status.type === "success"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 20px",
          background: status.type === "success" ? "#16a34a" : "#1877f2",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: status.type === "waiting" || status.type === "processing" || status.type === "success"
            ? "not-allowed"
            : "pointer",
          opacity: status.type === "waiting" || status.type === "processing" ? 0.7 : 1,
          transition: "all 0.15s",
        }}
      >
        {status.type === "success" ? "✓ CoEx ativado" : "Ativar CoEx via Facebook"}
      </button>

      <div style={{ marginTop: 24 }}>
        <StatusBox status={status} />
      </div>
    </div>
  )
}

function StatusBox({ status }: { status: Status }) {
  if (status.type === "idle") return null

  const configs: Record<string, { bg: string; border: string; title: string }> = {
    waiting:    { bg: "#fefce8", border: "#fde047", title: "Aguardando popup..." },
    processing: { bg: "#eff6ff", border: "#93c5fd", title: "Processando código..." },
    success:    { bg: "#f0fdf4", border: "#86efac", title: "Ativação concluída!" },
    error:      { bg: "#fef2f2", border: "#fca5a5", title: "Erro" },
  }

  const cfg = configs[status.type]

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 8,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{cfg.title}</div>
      {status.type === "success" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "var(--mono)", fontSize: 12 }}>
          <span><strong>Phone Number ID:</strong> {status.phoneNumberId}</span>
          <span><strong>WABA ID:</strong> {status.wabaId}</span>
        </div>
      )}
      {status.type === "error" && (
        <div style={{ color: "#dc2626", fontFamily: "var(--mono)", fontSize: 12 }}>
          {status.message}
        </div>
      )}
    </div>
  )
}
