// Briefing Extractor — extrai briefing estruturado a partir de URL

import type { BriefingData } from './scriptGenerator'
import { DEFAULT_BRIEFING } from './scriptGenerator'

interface ExtractionResult {
  success: boolean
  briefing: Partial<BriefingData>
  rawText: string
  source: string
  error?: string
}

/**
 * Acessa uma URL e tenta extrair um briefing estruturado do conteúdo.
 */
export async function extractBriefingFromUrl(url: string): Promise<ExtractionResult> {
  try {
    // Validar URL
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        success: false,
        briefing: {},
        rawText: '',
        source: url,
        error: 'URL deve usar protocolo http ou https',
      }
    }

    // Buscar conteúdo
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SeazoneCreativeEngine/1.0',
        'Accept': 'text/html, application/json, text/plain',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return {
        success: false,
        briefing: {},
        rawText: '',
        source: url,
        error: `Erro ao acessar URL: HTTP ${res.status}`,
      }
    }

    const contentType = res.headers.get('content-type') || ''
    let rawText: string

    if (contentType.includes('application/json')) {
      const json = await res.json()
      rawText = JSON.stringify(json, null, 2)
      // Tentar extrair diretamente se for JSON estruturado
      const briefing = extractFromJson(json)
      if (Object.keys(briefing).length > 0) {
        return { success: true, briefing, rawText, source: url }
      }
    } else {
      rawText = await res.text()
    }

    // Limpar HTML
    if (contentType.includes('text/html')) {
      rawText = stripHtml(rawText)
    }

    // Extrair dados do texto
    const briefing = extractFromText(rawText)
    const fieldCount = Object.keys(briefing).length

    if (fieldCount === 0) {
      return {
        success: false,
        briefing: {},
        rawText: rawText.slice(0, 2000),
        source: url,
        error: 'Não foi possível extrair dados de briefing do conteúdo. Tente um link com informações do empreendimento.',
      }
    }

    return {
      success: true,
      briefing,
      rawText: rawText.slice(0, 2000),
      source: url,
    }
  } catch (err) {
    return {
      success: false,
      briefing: {},
      rawText: '',
      source: url,
      error: err instanceof Error ? err.message : 'Erro desconhecido ao acessar URL',
    }
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFromJson(json: Record<string, unknown>): Partial<BriefingData> {
  const briefing: Partial<BriefingData> = {}

  // Tentar mapeamento direto
  const fieldMappings: Record<string, keyof BriefingData> = {
    nome: 'nomeEmpreendimento',
    name: 'nomeEmpreendimento',
    empreendimento: 'nomeEmpreendimento',
    nomeEmpreendimento: 'nomeEmpreendimento',
    localizacao: 'localizacao',
    location: 'localizacao',
    endereco: 'localizacao',
    address: 'localizacao',
    tipo: 'tipo',
    type: 'tipo',
    roi: 'roi',
    rendimento: 'rendimentoMensal',
    rendimentoMensal: 'rendimentoMensal',
    ticket: 'ticketMedio',
    ticketMedio: 'ticketMedio',
    valorizacao: 'valorizacao',
    publicoAlvo: 'publicoAlvo',
    publico: 'publicoAlvo',
    cta: 'cta',
  }

  for (const [key, mappedKey] of Object.entries(fieldMappings)) {
    const value = json[key]
    if (typeof value === 'string' && value.trim()) {
      (briefing as Record<string, unknown>)[mappedKey] = value.trim()
    }
  }

  // Arrays
  if (Array.isArray(json.pontosFortes)) briefing.pontosFortes = json.pontosFortes.map(String)
  if (Array.isArray(json.diferenciais)) briefing.diferenciais = json.diferenciais.map(String)

  return briefing
}

function extractFromText(text: string): Partial<BriefingData> {
  const briefing: Partial<BriefingData> = {}

  // Nome do empreendimento
  const nomeMatch = text.match(/(?:empreendimento|projeto|nome)[:\s]*([^\n,\.]{3,60})/i)
  if (nomeMatch) briefing.nomeEmpreendimento = nomeMatch[1].trim()

  // Localização
  const locMatch = text.match(/(?:localiza[çc][ãa]o|endere[çc]o|bairro|onde|região)[:\s]*([^\n\.]{3,80})/i)
  if (locMatch) briefing.localizacao = locMatch[1].trim()

  // Tipo
  const tipoMatch = text.match(/(?:tipo|categoria|segmento)[:\s]*([^\n\.]{3,60})/i)
  if (tipoMatch) briefing.tipo = tipoMatch[1].trim()

  // ROI
  const roiMatch = text.match(/ROI[:\s]*(?:de\s*)?([\d,\.]+\s*%)/i)
  if (roiMatch) briefing.roi = roiMatch[1].trim()

  // Rendimento mensal
  const rendMatch = text.match(/rendimento[:\s]*(R\$[\s\d\.,]+)/i)
  if (rendMatch) briefing.rendimentoMensal = rendMatch[1].trim()

  // Ticket médio
  const ticketMatch = text.match(/ticket[:\s]*(R\$[\s\d\.,]+)/i)
  if (ticketMatch) briefing.ticketMedio = ticketMatch[1].trim()

  // Valorização
  const valMatch = text.match(/valoriza[çc][ãa]o[:\s]*([\d,\.]+\s*%)/i)
  if (valMatch) briefing.valorizacao = valMatch[1].trim()

  // Público-alvo
  const pubMatch = text.match(/(?:p[úu]blico|target|audiência)[:\s]*([^\n\.]{5,100})/i)
  if (pubMatch) briefing.publicoAlvo = pubMatch[1].trim()

  // CTA
  const ctaMatch = text.match(/(?:CTA|chamada|a[çc][ãa]o)[:\s]*([^\n\.]{5,80})/i)
  if (ctaMatch) briefing.cta = ctaMatch[1].trim()

  // Diferenciais (lista)
  const difMatch = text.match(/(?:diferenciais|destaques)[:\s]*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i)
  if (difMatch) {
    briefing.diferenciais = difMatch[1]
      .split(/[\n;,•\-]/)
      .map(s => s.trim())
      .filter(s => s.length > 3)
      .slice(0, 5)
  }

  return briefing
}

/**
 * Mescla briefing extraído da URL com o default para campos faltantes.
 */
export function fillBriefingDefaults(partial: Partial<BriefingData>): BriefingData {
  return {
    nomeEmpreendimento: partial.nomeEmpreendimento || DEFAULT_BRIEFING.nomeEmpreendimento,
    localizacao: partial.localizacao || DEFAULT_BRIEFING.localizacao,
    tipo: partial.tipo || DEFAULT_BRIEFING.tipo,
    roi: partial.roi || DEFAULT_BRIEFING.roi,
    rendimentoMensal: partial.rendimentoMensal || DEFAULT_BRIEFING.rendimentoMensal,
    ticketMedio: partial.ticketMedio || DEFAULT_BRIEFING.ticketMedio,
    valorizacao: partial.valorizacao || DEFAULT_BRIEFING.valorizacao,
    pontosFortes: partial.pontosFortes?.length ? partial.pontosFortes : DEFAULT_BRIEFING.pontosFortes,
    diferenciais: partial.diferenciais?.length ? partial.diferenciais : DEFAULT_BRIEFING.diferenciais,
    publicoAlvo: partial.publicoAlvo || DEFAULT_BRIEFING.publicoAlvo,
    cta: partial.cta || DEFAULT_BRIEFING.cta,
  }
}
