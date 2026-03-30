// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "./components/sidebar"

export const metadata: Metadata = {
  title: { default: "JS Lab", template: "%s · JS Lab" },
  description: "Laboratório de ferramentas e automações JS Sistemas",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflowY: "auto",
          background: "var(--bg-base)",
          display: "flex",
          flexDirection: "column",
        }}>
          {children}
        </main>
      </body>
    </html>
  )
}
