import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Atrás do Traefik/Easypanel — sem isso o auth.js rejeita o host com
  // UntrustedHost e o middleware falha aberto (bloqueio inteiro ignorado).
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Uso individual — só o Jonas pode entrar. Sem consulta ao banco de propósito,
    // pra manter compatível com Edge Runtime e continuar rodando dentro do middleware.
    async signIn({ profile }) {
      return profile?.email === "js9jonas@gmail.com"
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
