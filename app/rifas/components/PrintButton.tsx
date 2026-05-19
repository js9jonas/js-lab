"use client"

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        padding: "6px 18px", borderRadius: 6, background: "#16a34a",
        color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      }}
    >
      🖨 Imprimir / Salvar PDF
    </button>
  )
}
