"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import type { Rifa } from "../types"
import RifaFormPage from "../components/RifaFormPage"

export default function EditarRifaPage() {
  const { id } = useParams<{ id: string }>()
  const [rifa, setRifa] = useState<Rifa | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/rifas/${id}`)
      .then(r => r.json())
      .then(data => { setRifa(data); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ padding: 40, color: "var(--text-muted)", fontSize: 13 }}>Carregando...</div>
  )
  if (!rifa) return (
    <div style={{ padding: 40, color: "var(--red)", fontSize: 13 }}>Rifa não encontrada.</div>
  )

  return <RifaFormPage rifaInicial={rifa} />
}
