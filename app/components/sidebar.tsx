"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"

// ─── Definição das páginas / módulos ─────────────────────────────────────────

const NAV = [
  {
    group: "Principal",
    items: [
      { href: "/",           label: "Dashboard",    icon: "⬡", color: "#3b82f6" },
      { href: "/mensagens",  label: "Mensagens",    icon: "◈", color: "#22c55e" },
    ],
  },
  {
    group: "WhatsApp",
    items: [
      { href: "/evolution",  label: "Instâncias",   icon: "◉", color: "#14b8a6" },
      { href: "/simulador",  label: "Simulador",    icon: "▷", color: "#a78bfa" },
    ],
  },
  {
    group: "Em breve",
    items: [
      { href: "/recibo",     label: "Recibo PDF",   icon: "◫", color: "#f59e0b", soon: true },
      { href: "/ocr",        label: "OCR",          icon: "◎", color: "#f59e0b", soon: true },
      { href: "/agente",     label: "Agente IA",    icon: "◆", color: "#f59e0b", soon: true },
    ],
  },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      flexShrink: 0,
      overflowY: "auto",
    }}>

      {/* Logo */}
      <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          JS <span style={{ color: "#3b82f6" }}>Lab</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--mono)" }}>
          v0.1 · local
        </div>
      </div>

      {/* Navegação */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {NAV.map(section => (
          <div key={section.group} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", padding: "0 8px 8px", textTransform: "uppercase" as const }}>
              {section.group}
            </div>
            {section.items.map(item => {
              const active = item.href === "/" ? path === "/" : path.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 8,
                    marginBottom: 2,
                    textDecoration: "none",
                    background: active ? "var(--bg-active)" : "transparent",
                    border: active ? "1px solid var(--border-light)" : "1px solid transparent",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    opacity: "soon" in item && item.soon ? 0.35 : 1,
                    pointerEvents: "soon" in item && item.soon ? "none" : "auto",
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: 13, color: active ? item.color : "var(--text-muted)", width: 16, textAlign: "center" as const, flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {"soon" in item && item.soon && (
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--mono)" }}>soon</span>
                  )}
                  {active && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Rodapé: status */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, letterSpacing: "0.07em" }}>SISTEMA</div>
        <StatusDot label="Evolution API" checkUrl="/api/evolution/instance/fetchInstances" />
        <StatusDot label="PostgreSQL"    checkUrl="/api/lab/logs?limit=1" />
      </div>
    </aside>
  )
}

// ─── Dot de status com ping automático ───────────────────────────────────────

function StatusDot({ label, checkUrl }: { label: string; checkUrl: string }) {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    check()
    const t = setInterval(check, 30000)
    return () => clearInterval(t)

    async function check() {
      try {
        const res = await fetch(checkUrl)
        setOk(res.ok)
      } catch {
        setOk(false)
      }
    }
  }, [checkUrl])

  const color = ok === null ? "#4b5263" : ok ? "#22c55e" : "#ef4444"

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: ok ? `0 0 5px ${color}88` : "none", flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
    </div>
  )
}

// useState e useEffect precisam ser importados aqui pois StatusDot é client
import { useState, useEffect } from "react"