"use client"

export default function ExportarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      zIndex: 9999, 
      background: "#eef0f4",
      overflow: "auto"
    }}>
      {children}
    </div>
  )
}