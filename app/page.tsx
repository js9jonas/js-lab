"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

// ─── Card de acesso rápido ────────────────────────────────────────────────────

function NavCard({ href, icon, label, desc, color, badge }: {
  href: string; icon: string; label: string; desc: string
  color: string; badge?: string | number
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${color}18` }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "18", border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color }}>
            {icon}
          </div>
          {badge !== undefined && badge !== 0 && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: color + "22", color, fontWeight: 600, border: `1px solid ${color}44` }}>{badge}</span>
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</div>
        </div>
      </div>
    </Link>
  )
}

// ─── Estatísticas do sistema ──────────────────────────────────────────────────

interface Stats {
  mensagens_hoje: number
  conversas_ativas: number
  agentes_ativos: number
  aprendizados_pendentes: number
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    // Busca estatísticas em paralelo
    Promise.all([
      fetch("/api/lab/logs?limit=1").then(r => r.json()).catch(() => []),
      fetch("/api/chat/conversations").then(r => r.json()).catch(() => []),
      fetch("/api/agentes").then(r => r.json()).catch(() => []),
    ]).then(([logs, convs, agentes]) => {
      const agentesArr = Array.isArray(agentes) ? agentes as { ativo: boolean; aprendizados_pendentes: number }[] : []
      setStats({
        mensagens_hoje: Array.isArray(logs) ? logs.length : 0,
        conversas_ativas: Array.isArray(convs) ? (convs as unknown[]).length : 0,
        agentes_ativos: agentesArr.filter(a => a.ativo).length,
        aprendizados_pendentes: agentesArr.reduce((s, a) => s + (a.aprendizados_pendentes ?? 0), 0),
      })
    })
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Topbar */}
      <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Dashboard</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          JS Laboratório — visão geral
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>

        {/* Métricas rápidas */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Conversas",         value: stats.conversas_ativas,       color: "#16a34a" },
              { label: "Agentes ativos",     value: stats.agentes_ativos,         color: "#7c3aed" },
              { label: "Aprendizados",       value: stats.aprendizados_pendentes, color: "#d97706" },
              { label: "Msgs recentes",      value: stats.mensagens_hoje,         color: "#2563eb" },
            ].map(m => (
              <div key={m.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Navegação principal */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em", marginBottom: 14 }}>ACESSO RÁPIDO</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <NavCard href="/chat"      icon="◫" color="#16a34a" label="Chat"        desc="Conversas em tempo real com clientes via WhatsApp" />
            <NavCard href="/mensagens" icon="◈" color="#22c55e" label="Mensagens"   desc="Feed de webhooks recebidos com classificação e logs" />
            <NavCard href="/agentes"   icon="◆" color="#7c3aed" label="Agentes IA"  desc="Gerenciar agentes, módulos e chat de refinamento"
              badge={stats?.aprendizados_pendentes || undefined} />
            <NavCard href="/evolution" icon="◉" color="#14b8a6" label="Instâncias"  desc="Gerenciar instâncias WhatsApp e configurar webhooks" />
          </div>
        </div>

        {/* Dica */}
        {stats?.aprendizados_pendentes && stats.aprendizados_pendentes > 0 ? (
          <div style={{ marginTop: 20, background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>◆</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#7c3aed" }}>
                {stats.aprendizados_pendentes} aprendizado{stats.aprendizados_pendentes !== 1 ? "s" : ""} pendente{stats.aprendizados_pendentes !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 12, color: "#6d28d9", marginTop: 2 }}>
                Há interações registradas que ainda não foram incorporadas ao prompt dos agentes.
              </div>
            </div>
            <Link href="/agentes" style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", textDecoration: "none", padding: "6px 14px", borderRadius: 8, border: "1px solid #e9d5ff", background: "#ede9fe", whiteSpace: "nowrap" }}>
              Ver agentes →
            </Link>
          </div>
        ) : null}

      </div>
    </div>
  )
}
