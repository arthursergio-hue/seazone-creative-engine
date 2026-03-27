// Agente 1: Estrategista Criativo
// Analisa briefing e define estratégia de comunicação

import type { Agent, AgentContext, AgentResult, AgentTrace, StrategyOutput, AgentLogEntry } from './types'
import { SEAZONE_BRAND } from '@/context/seazone'

export const EstrategistaCriativo: Agent<AgentContext, StrategyOutput> = {
  name: 'EstrategistaCriativo',
  description: 'Analisa o briefing e define a estratégia criativa: tom, ordem das cenas, mensagens-chave e alinhamento com a marca.',

  async execute(input, context, log): Promise<AgentResult<StrategyOutput>> {
    const trace: AgentTrace = {
      agent: 'EstrategistaCriativo' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { briefing: context.briefing, format: context.format },
      logs: [] as AgentLogEntry[],
    }

    try {
      log('Analisando briefing do empreendimento...')
      const b = context.briefing

      // Determinar tom baseado no público
      const isInvestor = b.publicoAlvo?.toLowerCase().includes('investidor')
      const isYoung = b.publicoAlvo?.toLowerCase().includes('jovem') || b.publicoAlvo?.toLowerCase().includes('25')

      let tone = SEAZONE_BRAND.tone.voice
      if (isInvestor) tone = 'Dados concretos com autoridade. Foco em retorno e segurança.'
      if (isYoung) tone = 'Moderno e aspiracional. Foco em experiência e lifestyle.'

      log(`Tom definido: ${tone}`)

      // Definir hook inicial
      const hasHighRoi = parseFloat(b.roi?.replace(',', '.').replace('%', '') || '0') > 12
      const hook = hasHighRoi
        ? `ROI de ${b.roi} — seu dinheiro trabalhando por você`
        : `${b.nomeEmpreendimento} — investimento inteligente em ${b.localizacao.split(',')[0]}`

      log(`Hook: "${hook}"`)

      // Definir ordem das cenas baseada na estratégia
      const sceneOrder = determineSceneOrder(context)
      log(`Ordem das cenas: ${sceneOrder.join(' -> ')}`)

      // Mensagens-chave extraídas do briefing
      const keyMessages = [
        b.roi ? `ROI de ${b.roi}` : null,
        b.rendimentoMensal ? `Rendimento de ${b.rendimentoMensal}/mês` : null,
        b.valorizacao ? `Valorização de ${b.valorizacao}` : null,
        ...b.pontosFortes.slice(0, 2),
      ].filter(Boolean) as string[]

      log(`${keyMessages.length} mensagens-chave identificadas`, 'success')

      // Verificar alinhamento com brand
      const brandAlignment = checkBrandAlignment(b)
      log(`Alinhamento com marca: ${brandAlignment}`)

      const output: StrategyOutput = {
        targetAudience: b.publicoAlvo || 'Investidores imobiliários',
        tone,
        hook,
        cta: b.cta || 'Fale com um consultor',
        sceneOrder,
        keyMessages,
        brandAlignment,
      }

      trace.status = 'completed'
      trace.completedAt = new Date().toISOString()
      trace.output = output as unknown as Record<string, unknown>

      log('Estratégia criativa definida com sucesso', 'success')

      return { success: true, data: output, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}

function determineSceneOrder(context: AgentContext): string[] {
  const b = context.briefing
  const hasHighRoi = parseFloat(b.roi?.replace(',', '.').replace('%', '') || '0') > 12

  // Estratégia: começar pelo gancho mais forte
  if (hasHighRoi) {
    return ['roi', 'localizacao', 'fachada', 'lifestyle', 'rendimento', 'rooftop', 'apresentadora']
  }
  return ['localizacao', 'fachada', 'roi', 'lifestyle', 'rendimento', 'rooftop', 'apresentadora']
}

function checkBrandAlignment(b: import('../lib/scriptGenerator').BriefingData): string {
  const issues: string[] = []

  // Verificar se não usa linguagem proibida
  const forbidden = SEAZONE_BRAND.tone.doNot
  const allText = `${b.nomeEmpreendimento} ${b.pontosFortes.join(' ')} ${b.diferenciais.join(' ')} ${b.cta}`

  if (allText.toLowerCase().includes('garantido')) {
    issues.push('Evitar "garantido" — promessa de ganho garantido')
  }

  if (issues.length === 0) return 'Totalmente alinhado com guidelines Seazone'
  return `Atenção: ${issues.join('; ')}`
}
