// Agente 4: Gerador de Peças
// Gera textos, títulos, overlays e hashtags para cada cena

import type { Agent, AgentContext, AgentResult, AgentTrace, PieceOutput, AgentLogEntry } from './types'

export const GeradorDePecas: Agent<AgentContext, PieceOutput[]> = {
  name: 'GeradorDePecas',
  description: 'Gera textos de overlay, títulos, subtítulos e hashtags para cada peça criativa.',

  async execute(input, context, log): Promise<AgentResult<PieceOutput[]>> {
    const trace: AgentTrace = {
      agent: 'GeradorDePecas' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { sceneCount: context.script?.scenes.length },
      logs: [] as AgentLogEntry[],
    }

    try {
      const script = context.script
      if (!script) throw new Error('Roteiro não disponível')

      log('Gerando peças de texto para cada cena...')
      const pieces: PieceOutput[] = []

      for (const scene of script.scenes) {
        log(`  ${scene.type}: gerando textos...`, 'debug')

        const piece: PieceOutput = {
          type: scene.type,
          title: scene.screenText.title,
          subtitle: scene.screenText.subtitle,
          overlayText: buildOverlayText(scene.type, context),
          hashtags: generateHashtags(scene.type, context),
        }

        pieces.push(piece)
      }

      log(`${pieces.length} peças de texto geradas`, 'success')

      trace.status = 'completed'
      trace.completedAt = new Date().toISOString()
      trace.output = { total: pieces.length }

      return { success: true, data: pieces, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}

function buildOverlayText(type: string, context: AgentContext): string {
  const b = context.briefing
  const overlays: Record<string, string> = {
    localizacao: `${b.localizacao.split(',')[0]} | ${b.valorizacao ? `Valorização ${b.valorizacao}` : 'Localização premium'}`,
    fachada: `${b.nomeEmpreendimento} | ${b.tipo}`,
    roi: `ROI ${b.roi} | Acima da Selic`,
    rendimento: `${b.rendimentoMensal}/mês | Renda passiva real`,
    lifestyle: `Design contemporâneo | Experiência premium`,
    rooftop: `Rooftop com piscina | Área de lazer exclusiva`,
    apresentadora: `${b.cta} | seazone.com.br`,
  }
  return overlays[type] || ''
}

function generateHashtags(type: string, context: AgentContext): string[] {
  const b = context.briefing
  const city = b.localizacao.split(',')[0].trim().toLowerCase().replace(/\s+/g, '')

  const base = ['#seazone', '#investimentoimobiliario', `#${city}`]
  const specific: Record<string, string[]> = {
    localizacao: ['#localizacao', '#imoveistemporada'],
    fachada: ['#arquitetura', '#empreendimento'],
    roi: ['#roi', '#rendimento', '#investimento'],
    rendimento: ['#rendapassiva', '#rentabilidade'],
    lifestyle: ['#design', '#studio', '#interiordesign'],
    rooftop: ['#rooftop', '#lazer', '#piscina'],
    apresentadora: ['#consultoria', '#investecomseazone'],
  }

  return [...base, ...(specific[type] || [])]
}
