"use client"
import { useState, useEffect } from "react"

interface QuickReply { id: number; instance: string; keyword: string; message: string }

export default function QuickRepliesModal({ instance, onClose }: { instance: string; onClose: () => void }) {
  const [items, setItems]       = useState<QuickReply[]>([])
  const [keyword, setKeyword]   = useState("")
  const [message, setMessage]   = useState("")
  const [editId, setEditId]     = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/chat/quick-replies?instance=${encodeURIComponent(instance)}`)
    const data = await res.json() as { quickReplies: QuickReply[] }
    setItems(data.quickReplies ?? [])
  }

  useEffect(() => { load() }, [instance]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(item: QuickReply) {
    setEditId(item.id)
    setKeyword(item.keyword)
    setMessage(item.message)
    setError(null)
  }

  function cancelEdit() {
    setEditId(null); setKeyword(""); setMessage(""); setError(null)
  }

  async function save() {
    if (!keyword.trim() || !message.trim()) { setError("Preencha atalho e mensagem."); return }
    setSaving(true); setError(null)
    try {
      if (editId) {
        await fetch("/api/chat/quick-replies", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, keyword: keyword.trim(), message: message.trim() }),
        })
      } else {
        await fetch("/api/chat/quick-replies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instance, keyword: keyword.trim(), message: message.trim() }),
        })
      }
      cancelEdit()
      await load()
    } catch { setError("Erro ao salvar.") }
    finally { setSaving(false) }
  }

  async function remove(id: number) {
    if (!confirm("Remover esta resposta rápida?")) return
    await fetch(`/api/chat/quick-replies?id=${id}`, { method: "DELETE" })
    await load()
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>⚡ Respostas Rápidas</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Instância: {instance} · Digite / no chat para usar</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>✕</button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Nenhuma resposta rápida cadastrada ainda.</div>
          )}
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 20px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "1px 8px", fontFamily: "monospace" }}>/{item.keyword}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.message}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2 }}>
                <button onClick={() => startEdit(item)} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#374151" }}>Editar</button>
                <button onClick={() => remove(item.id)} style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#e11d48" }}>Remover</button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulário */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", borderRadius: "0 0 14px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{editId ? "Editando resposta" : "Nova resposta rápida"}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, paddingLeft: 10, flex: "0 0 140px" }}>
              <span style={{ color: "#2563eb", fontWeight: 700, fontSize: 14, marginRight: 2 }}>/</span>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value.replace(/^\//, ""))}
                placeholder="atalho"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13, padding: "7px 6px 7px 0", background: "transparent", fontFamily: "monospace" }}
              />
            </div>
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Texto da mensagem..."
            rows={3}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #e5e7eb", padding: "8px 12px", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
          />
          {error && <div style={{ fontSize: 12, color: "#e11d48", marginTop: 4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            {editId && <button onClick={cancelEdit} style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, cursor: "pointer", color: "#6b7280" }}>Cancelar</button>}
            <button onClick={save} disabled={saving} style={{ padding: "6px 18px", borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Salvando..." : editId ? "Salvar alteração" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
