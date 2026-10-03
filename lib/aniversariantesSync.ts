// Sincroniza lab.aniversariantes (grupo MEMBRO CRUZEIRO) com o cadastro de membros do js-comunidade
// (schema gestao_comunidade, mesmo banco). Só LÊ o cadastro da comunidade; grava só em lab.*.
// Regras combinadas com o Jonas (02/10/2026):
// - nome vem do cadastro; data de nascimento da lista é validada (divergência só é avisada);
// - telefone já existente na lista é validado (só padroniza); sem telefone → celular próprio com WhatsApp,
//   senão o celular do titular (dependente);
// - sai quem está falecido, transferido, desligado (inativo) ou excluído, ou não existe mais no cadastro;
// - entra quem está ativo no cadastro, com data de nascimento, e ainda não está na lista.
// As regras de nome e telefone espelham js-comunidade/lib/nomesSimilares.ts e lib/contatos.ts.

type Executor = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> }

export const GRUPO = "MEMBRO CRUZEIRO"
const STATUS_FORA = ["falecido", "transferido", "inativo", "excluido"]
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"])
const DDDS = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46,
  47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91,
  92, 93, 94, 95, 96, 97, 98, 99])

const normalizarNome = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ")

function distancia(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[a.length][b.length]
}

/** Mesmo critério do aviso de nome parecido do js-comunidade (letra trocada ou nome a mais/a menos). */
function nomesParecidos(a: string, b: string) {
  const pa = normalizarNome(a).split(" ").filter(p => p && !PARTICULAS.has(p))
  const pb = normalizarNome(b).split(" ").filter(p => p && !PARTICULAS.has(p))
  if (pa.length < 2 || pb.length < 2) return false
  if (pa.length === pb.length) {
    const total = pa.reduce((s, p, i) => s + distancia(p, pb[i]), 0)
    if (total <= (Math.min(pa.join("").length, pb.join("").length) >= 15 ? 2 : 1)) return true
  }
  const [curto, longo] = pa.length < pb.length ? [pa, pb] : [pb, pa]
  if (curto.length === longo.length) return false
  let j = 0
  for (const p of longo) if (p === curto[j]) j++
  return j === curto.length
}

/** Telefone no padrão do cadastro: só dígitos, 55 + DDD + número (com 9º dígito no celular). */
export function normalizarTelefone(bruto: string): string | null {
  let d = bruto.replace(/\D/g, "").replace(/^0+/, "")
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2)
  if (d.length === 8 || d.length === 9) d = "51" + d
  if (d.length !== 10 && d.length !== 11) return null
  if (!DDDS.has(Number(d.slice(0, 2)))) return null
  let local = d.slice(2)
  if (local.length === 9 && local[0] !== "9") return null
  if (local.length === 8 && /^[6-9]/.test(local)) local = "9" + local
  return `55${d.slice(0, 2)}${local}`
}

type Pessoa = {
  chave: string; tipo: "membro" | "dependente"; id: number; nome: string; status: string
  dn: string | null; id_titular: number | null; tel: string | null
}
type Aniv = { id: number; nome: string; telefone: string | null; dn: string; ref: string | null }

export type Plano = {
  entram: { ref: string; nome: string; data_nasc: string; telefone: string | null; origem_tel: string | null; dependente_de: string | null }[]
  saem: { id: number; nome: string; motivo: string }[]
  nomes: { id: number; de: string; para: string }[]
  telefones: { id: number; nome: string; de: string | null; para: string; origem: "próprio" | "titular" | "padronizado" }[]
  datas_diferentes: { id: number; nome: string; lista: string; cadastro: string }[]
  vincular: { id: number; ref: string }[]
  sem_data_nascimento: number
  sem_telefone_depois: number
}

/** Calcula o que a sincronização faria, sem gravar nada. */
export async function calcularPlano(db: Executor): Promise<Plano> {
  const [{ rows: anvRows }, { rows: pesRows }] = await Promise.all([
    db.query(`SELECT id, nome, telefone, data_nasc::text AS dn, ref_comunidade AS ref FROM lab.aniversariantes WHERE grupo = $1`, [GRUPO]),
    db.query(`
      SELECT 'm' || m.id AS chave, 'membro' AS tipo, m.id, m.nome, m.status, m.data_nascimento::text AS dn, NULL::int AS id_titular,
             (SELECT x.valor FROM gestao_comunidade.contatos x WHERE x.id_membro = m.id AND x.whatsapp IS TRUE
               ORDER BY x.principal DESC, x.id LIMIT 1) AS tel
        FROM gestao_comunidade.membros m WHERE m.id_comunidade = 1
      UNION ALL
      SELECT 'd' || d.id, 'dependente', d.id, d.nome, d.status, d.data_nascimento::text, d.id_membro,
             (SELECT x.valor FROM gestao_comunidade.contatos x WHERE x.id_dependente = d.id AND x.whatsapp IS TRUE
               ORDER BY x.principal DESC, x.id LIMIT 1)
        FROM gestao_comunidade.dependentes d JOIN gestao_comunidade.membros t ON t.id = d.id_membro
       WHERE t.id_comunidade = 1 AND d.status IS DISTINCT FROM 'excluido'`),
  ])
  const anv = anvRows as Aniv[]
  const pessoas = new Map<string, Pessoa>((pesRows as Pessoa[]).map(p => [p.chave, p]))
  const porNome = new Map<string, Pessoa[]>()
  for (const p of pessoas.values()) { const k = normalizarNome(p.nome); porNome.set(k, [...(porNome.get(k) ?? []), p]) }

  const usados = new Set<string>()
  // Vínculo já gravado vale primeiro; senão, nome igual (data desempata) e, por último, nome parecido + mesma data.
  const achar = (a: Aniv): Pessoa | null => {
    if (a.ref && pessoas.has(a.ref) && !usados.has(a.ref)) return pessoas.get(a.ref)!
    let cs = (porNome.get(normalizarNome(a.nome)) ?? []).filter(p => !usados.has(p.chave))
    if (cs.length > 1) { const f = cs.filter(p => p.dn === a.dn); if (f.length) cs = f }
    if (cs.length === 1) return cs[0]
    const prov = [...pessoas.values()].filter(p => !usados.has(p.chave) && p.dn === a.dn && nomesParecidos(a.nome, p.nome))
    return prov.length === 1 ? prov[0] : null
  }
  const telefoneDe = (p: Pessoa): { tel: string; origem: "próprio" | "titular" } | null => {
    if (p.tel) return { tel: p.tel, origem: "próprio" }
    const t = p.id_titular ? pessoas.get(`m${p.id_titular}`) : null
    return t?.tel ? { tel: t.tel, origem: "titular" } : null
  }
  const br = (d: string) => d.split("-").reverse().join("/")

  const plano: Plano = { entram: [], saem: [], nomes: [], telefones: [], datas_diferentes: [], vincular: [], sem_data_nascimento: 0, sem_telefone_depois: 0 }
  // Vínculos gravados primeiro, para um nome repetido não "roubar" a pessoa de quem já está vinculado.
  const ordem = [...anv].sort((x, y) => Number(!!y.ref && pessoas.has(y.ref)) - Number(!!x.ref && pessoas.has(x.ref)))
  for (const a of ordem) {
    const p = achar(a)
    if (!p) { plano.saem.push({ id: a.id, nome: a.nome, motivo: "não está mais no cadastro" }); continue }
    usados.add(p.chave)
    if (STATUS_FORA.includes(p.status)) { plano.saem.push({ id: a.id, nome: a.nome, motivo: p.status }); continue }
    if (a.ref !== p.chave) plano.vincular.push({ id: a.id, ref: p.chave })
    if (a.nome !== p.nome) plano.nomes.push({ id: a.id, de: a.nome, para: p.nome })
    if (p.dn && p.dn !== a.dn) plano.datas_diferentes.push({ id: a.id, nome: p.nome, lista: br(a.dn), cadastro: br(p.dn) })
    if (a.telefone?.trim()) {
      const n = normalizarTelefone(a.telefone)
      if (n && n !== a.telefone) plano.telefones.push({ id: a.id, nome: p.nome, de: a.telefone, para: n, origem: "padronizado" })
    } else {
      const t = telefoneDe(p)
      if (t) plano.telefones.push({ id: a.id, nome: p.nome, de: null, para: t.tel, origem: t.origem })
      else plano.sem_telefone_depois++
    }
  }
  for (const p of pessoas.values()) {
    if (usados.has(p.chave) || p.status !== "ativo") continue
    if (!p.dn) { plano.sem_data_nascimento++; continue }
    const t = telefoneDe(p)
    if (!t) plano.sem_telefone_depois++
    const titular = p.id_titular ? pessoas.get(`m${p.id_titular}`)?.nome ?? null : null
    plano.entram.push({ ref: p.chave, nome: p.nome, data_nasc: p.dn, telefone: t?.tel ?? null, origem_tel: t?.origem ?? null, dependente_de: titular })
  }
  plano.entram.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
  plano.saem.sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
  return plano
}

/** Resumo para conferir se o plano aplicado é o mesmo que o usuário viu na prévia. */
export function assinatura(p: Plano) {
  return JSON.stringify([p.entram.map(e => e.ref), p.saem.map(s => s.id), p.nomes.length, p.telefones.length, p.vincular.length])
}

/** Aplica o plano dentro da transação de quem chama. */
export async function aplicarPlano(db: Executor, plano: Plano) {
  for (const s of plano.saem) {
    await db.query(
      `INSERT INTO lab.aniversariantes_removidos (id_original, nome, telefone, data_nasc, grupo, observacao, ref_comunidade, motivo)
       SELECT id, nome, telefone, data_nasc, grupo, observacao, ref_comunidade, $2 FROM lab.aniversariantes WHERE id = $1`,
      [s.id, s.motivo])
    await db.query(`DELETE FROM lab.aniversariantes WHERE id = $1`, [s.id])
  }
  for (const v of plano.vincular) await db.query(`UPDATE lab.aniversariantes SET ref_comunidade = $2 WHERE id = $1`, [v.id, v.ref])
  for (const n of plano.nomes) await db.query(`UPDATE lab.aniversariantes SET nome = $2, atualizado_em = now() WHERE id = $1`, [n.id, n.para])
  for (const t of plano.telefones) await db.query(`UPDATE lab.aniversariantes SET telefone = $2, atualizado_em = now() WHERE id = $1`, [t.id, t.para])
  for (const e of plano.entram) {
    await db.query(
      `INSERT INTO lab.aniversariantes (nome, telefone, data_nasc, grupo, ativo, observacao, ref_comunidade)
       VALUES ($1, $2, $3, $4, true, $5, $6)`,
      [e.nome, e.telefone, e.data_nasc, GRUPO, e.dependente_de ? `dependente de ${e.dependente_de}` : null, e.ref])
  }
}
