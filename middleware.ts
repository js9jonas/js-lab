import { NextResponse } from "next/server"
import { auth } from "@/auth"

// Rotas chamadas por serviços externos que não conseguem passar sessão —
// precisam ficar acessíveis sem login. Tudo mais no app exige autenticação Google.
const PUBLIC_PATHS = [
  "/api/webhook",
  "/api/evolution/webhook",
  "/api/coex/activate",
  "/api/alexa",
  "/login",
  "/api/auth",
]

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  if (req.auth) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  return NextResponse.redirect(new URL("/login", req.url))
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
