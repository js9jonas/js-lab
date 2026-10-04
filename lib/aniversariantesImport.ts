// Importação de aniversariantes que não são membros a partir de uma lista colada (ou CSV), uma pessoa
// por linha: "Nome; DD/MM[/AAAA]; telefone opcional".
// Grupo automático (regra do Jonas, 03/10/2026): telefone com assinatura ativa no js-painel → CLIENTE;
// senão → AMIGO - FAMÍLIA. Mesma regra da função lab.telefone_cliente_ativo (sql/2026-10-03_…_cliente_ativo),
// que o n8n usa na hora de escolher a mensagem — lá vale a situação do dia, não o grupo gravado.
// Separador: ";" ou tab; vírgula só quando a linha não tem nenhum dos dois.
// O grupo MEMBRO CRUZEIRO não entra aqui — ele vem do cadastro do js-comunidade (aniversariantesSync),
// e quem fosse importado nele à mão sairia na próxima sincronização.
import { GRUPO as GRUPO_MEMBROS, normalizarNome, nomesParecidos, normalizarTelefone } from "./aniversariantesSync"

export const GRUPO_CLIENTE = "CLIENTE"
export const GRUPO_AMIGOS = "AMIGO - FAMÍLIA"
export const GRUPOS = [GRUPO_MEMBROS, GRUPO_CLIENTE, GRUPO_AMIGOS] as const

/** Ano usado em data_nasc quando o ano é desconhecido (bissexto, aceita 29/02). */
export const ANO_DESCONHECIDO = 2000

/** Ano desconhecido: troca o ano de data_nasc (AAAA-MM-DD) pelo marcador — idade fica nula. */
export function dataComAno(data_nasc: string, ano_desconhecido: boolean): string {
  return ano_desconhecido ? `${ANO_DESCONHECIDO}${data_nasc.slice(4, 10)}` : data_nasc
}

type Executor = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> }

export type LinhaImport = {
  linha: number
  nome: string
  data_nasc: string            // AAAA-MM-DD (ano 2000 quando desconhecido)
  ano_desconhecido: boolean
  telefone: string | null
  grupo: string
  avisos: string[]
}

export type PlanoImport = {
  novos: LinhaImport[]
  ja_na_lista: { linha: number; nome: string; grupo: string | null }[]
  erros: { linha: number; texto: string; motivo: string }[]
}

function dataValida(a: number, m: number, d: number) {
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** "DD/MM", "DD/MM/AAAA", "DD/MM/AA", "DD-MM-AAAA" ou "AAAA-MM-DD". */
export function interpretarData(bruto: string): { data: string; ano_desconhecido: boolean } | null {
  const t = bruto.trim()
  let d: number, m: number, a: number | null = null
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (r) { a = +r[1]; m = +r[2]; d = +r[3] }
  else {
    r = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/)
    if (!r) return null
    d = +r[1]; m = +r[2]
    if (r[3]) a = r[3].length === 2 ? (+r[3] > new Date().getFullYear() % 100 ? 1900 : 2000) + +r[3] : +r[3]
  }
  const ano = a ?? ANO_DESCONHECIDO
  if (!dataValida(ano, m, d)) return null
  if (a != null && (a < 1900 || a > new Date().getFullYear())) return null
  const pad = (n: number) => String(n).padStart(2, "0")
  return { data: `${ano}-${pad(m)}-${pad(d)}`, ano_desconhecido: a == null }
}

function separar(linha: string): string[] {
  const sep = linha.includes(";") ? ";" : linha.includes("\t") ? "\t" : ","
  return linha.split(sep).map(c => c.trim())
}

export async function calcularImport(db: Executor, texto: string): Promise<PlanoImport> {
  const { rows: existentes } = await db.query(`SELECT id, nome, grupo FROM lab.aniversariantes`)
  // Chaves (DDD + últimos 8 dígitos) dos telefones com assinatura ativa — 1 consulta só, em vez de
  // chamar lab.telefone_cliente_ativo linha a linha
  const { rows: clientes } = await db.query(
    `SELECT DISTINCT lab.chave_telefone(ct.telefone) AS chave
     FROM public.contatos ct JOIN public.assinaturas a ON a.id_cliente = ct.id_cliente
     WHERE a.status = 'ativo' AND lab.chave_telefone(ct.telefone) IS NOT NULL`
  )
  const chavesClientes = new Set<string>(clientes.map(r => r.chave))
  const chave = (tel: string) => tel.startsWith("55") ? tel.slice(2, 4) + tel.slice(-8) : null
  const plano: PlanoImport = { novos: [], ja_na_lista: [], erros: [] }
  const vistos = new Map<string, number>()

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1
    if (!bruta.trim()) return
    const [nomeBruto = "", dataBruta = "", telBruto = ""] = separar(bruta)
    const nome = nomeBruto.replace(/\s+/g, " ").trim()
    // Cabeçalho de CSV ("nome;data;telefone") é ignorado sem virar erro
    if (linha === 1 && /^nome$/i.test(nome) && !interpretarData(dataBruta)) return
    if (!nome) { plano.erros.push({ linha, texto: bruta, motivo: "sem nome" }); return }
    const data = interpretarData(dataBruta)
    if (!data) { plano.erros.push({ linha, texto: bruta, motivo: dataBruta ? `data inválida (${dataBruta})` : "sem data" }); return }

    const nomeNorm = normalizarNome(nome)
    if (vistos.has(nomeNorm)) { plano.erros.push({ linha, texto: bruta, motivo: `repetido na lista colada (linha ${vistos.get(nomeNorm)})` }); return }
    vistos.set(nomeNorm, linha)

    const igual = existentes.find(e => normalizarNome(e.nome) === nomeNorm)
    if (igual) { plano.ja_na_lista.push({ linha, nome, grupo: igual.grupo }); return }

    const avisos: string[] = []
    let telefone: string | null = null
    if (telBruto) {
      telefone = normalizarTelefone(telBruto)
      if (!telefone) avisos.push(`telefone "${telBruto}" inválido, fica sem telefone`)
    }
    const parecido = existentes.find(e => nomesParecidos(e.nome, nome))
    if (parecido) avisos.push(`nome parecido com "${parecido.nome}" (${parecido.grupo ?? "sem grupo"}), confira se não é a mesma pessoa`)
    const k = telefone ? chave(telefone) : null
    const grupo = k && chavesClientes.has(k) ? GRUPO_CLIENTE : GRUPO_AMIGOS
    plano.novos.push({ linha, nome, data_nasc: data.data, ano_desconhecido: data.ano_desconhecido, telefone, grupo, avisos })
  })
  return plano
}

export async function aplicarImport(db: Executor, plano: PlanoImport): Promise<number> {
  for (const n of plano.novos) {
    await db.query(
      `INSERT INTO lab.aniversariantes (nome, telefone, data_nasc, ano_desconhecido, grupo, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [n.nome, n.telefone, n.data_nasc, n.ano_desconhecido, n.grupo, null]
    )
  }
  return plano.novos.length
}
