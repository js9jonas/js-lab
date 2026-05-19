export interface RifaOrganizacao {
  id: number
  nome: string
  subtitulo: string | null
  endereco: string | null
  cidade: string | null
  telefone: string | null
  logo_url: string | null
  criado_em: string
}

export interface RifaPremio {
  id?: number
  rifa_id?: number
  posicao: number
  descricao: string
}

export type Tema = 'classico' | 'festivo' | 'elegante'
export type BordaEstilo = 'sem' | 'simples' | 'grossa' | 'dupla' | 'arredondada'
export type FundoCabecalho = 'branco' | 'cinza-claro' | 'cinza-medio'
export type Orientacao = 'retrato' | 'paisagem'
export type TamanhoPapel = 'A4' | 'Carta'

export interface Rifa {
  id: number
  organizacao_id: number | null
  titulo: string
  detalhes: string | null
  valor_numero: number
  data_sorteio: string | null
  local_sorteio: string | null
  numero_inicial: number
  quantidade_total: number
  numeros_por_pagina: number
  colunas_premios: number
  tema: Tema
  fonte: string
  borda_estilo: BordaEstilo
  zebrado: boolean
  emoji_premios: boolean
  fundo_cabecalho: FundoCabecalho
  orientacao: Orientacao
  tamanho_papel: TamanhoPapel
  criado_em: string
  atualizado_em: string
  organizacao?: RifaOrganizacao
  premios?: RifaPremio[]
}

export type RifaPayload = Omit<Rifa, 'id' | 'criado_em' | 'atualizado_em' | 'organizacao'> & {
  premios: RifaPremio[]
}

export const TEMAS: Record<Tema, Partial<RifaPayload>> = {
  classico: { fonte: 'Arial', borda_estilo: 'simples', emoji_premios: false, fundo_cabecalho: 'cinza-claro', zebrado: true },
  festivo:  { fonte: 'Montserrat', borda_estilo: 'grossa', emoji_premios: true, fundo_cabecalho: 'cinza-claro', zebrado: true },
  elegante: { fonte: 'Georgia', borda_estilo: 'dupla', emoji_premios: false, fundo_cabecalho: 'branco', zebrado: false },
}

export const EMOJI_PREMIOS: Record<number, string> = {
  1: '🏆', 2: '🥈', 3: '🥉',
}
export const EMOJI_DEFAULT = '🎁'

export function formatNumero(n: number, total: number): string {
  const digits = String(total + (total < 100 ? 100 : 0)).length
  return String(n).padStart(Math.max(digits, 3), '0')
}

export function formatMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(d: string | Date | null): string {
  if (!d) return ''
  const str = (typeof d === 'string' ? d : d.toISOString()).split('T')[0]
  const [y, m, day] = str.split('-')
  return `${day}/${m}/${y}`
}
