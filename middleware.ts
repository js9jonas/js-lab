import { NextRequest, NextResponse } from "next/server"

// Rotas chamadas por serviços externos que não conseguem enviar Basic Auth —
// precisam ficar acessíveis sem senha. Tudo mais no app exige autenticação.
const PUBLIC_PATHS = [
  "/api/webhook",
  "/api/evolution/webhook",
  "/api/coex/activate",
  "/api/alexa",
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  const user = process.env.LAB_AUTH_USER
  const pass = process.env.LAB_AUTH_PASS

  const expected = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64")
  const provided = req.headers.get("authorization")

  if (provided === expected) {
    return NextResponse.next()
  }

  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="js-lab"' },
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
