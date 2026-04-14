// lib/contact-lookup.ts
// Cache em memória por sessão. Evita múltiplas queries para o mesmo JID.

const cache = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()

/**
 * Retorna o nome do contato para um JID.
 * Ordem de fallback: contatos DB → profileName → null
 */
export async function getContactName(
  jid: string,
  profileName?: string | null
): Promise<string | null> {
  if (jid.endsWith("@g.us")) return profileName ?? null

  if (cache.has(jid)) {
    return cache.get(jid) ?? profileName ?? null
  }

  if (pending.has(jid)) {
    const dbName = await pending.get(jid)!
    return dbName ?? profileName ?? null
  }

  const promise = fetch(`/api/chat/contact-name?jid=${encodeURIComponent(jid)}`)
    .then(r => r.json() as Promise<{ name: string | null }>)
    .then(d => d.name ?? null)
    .catch(() => null)
    .finally(() => pending.delete(jid))

  pending.set(jid, promise)
  const dbName = await promise
  cache.set(jid, dbName)
  return dbName ?? profileName ?? null
}

/** Invalida o cache de um JID específico (ex: após atualização de dados). */
export function invalidateContactName(jid: string) {
  cache.delete(jid)
}
