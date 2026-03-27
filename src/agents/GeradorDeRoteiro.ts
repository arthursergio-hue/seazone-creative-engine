// Agente 2: Gerador de Roteiro
// Gera roteiro dinâmico baseado na estratégia e briefing

import type { Agent, AgentContext, AgentResult, AgentTrace, AgentLogEntry } from './types'
import { generateScript, type GeneratedScript, type CreativeSceneType } from '@/lib/scriptGenerator'

export const GeradorDeRoteiro: Agent<AgentContext, GeneratedScript> = {
  name: 'GeradorDeRoteiro',
  description: 'Gera roteiro completo com narração, prompts visuais e textos de overlay para cada cena.',

  async execute(input, context, log): Promise<AgentResult<GeneratedScript>> {
    const trace: AgentTrace = {
      agent: 'GeradorDeRoteiro' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { briefing: context.briefing, strategy: context.strategy },
      logs: [] as AgentLogEntry[],
    }

    try {
      log('Gerando roteiro a partir do briefing e estratégia...')

      // Usar a ordem de cenas da estratégia, se disponível
      const strategy = context.strategy
      let sceneTypes: CreativeSceneType[]

      if (strategy?.sceneOrder) {
        // Filtrar apenas os tipos que foram selecionados
        const validTypes: CreativeSceneType[] = ['localizacao', 'fachada', 'roi', 'rendimento', 'lifestyle', 'rooftop', 'apresentadora']
        sceneTypes = strategy.sceneOrder.filter(
          t => validTypes.includes(t as CreativeSceneType)
        ) as CreativeSceneType[]
        log(`Usando ordem da estratégia: ${sceneTypes.join(' -> ')}`)
      } else {
        sceneTypes = ['localizacao', 'roi', 'rendimento', 'apresentadora']
        log('Sem estratégia definida, usando ordem padrão')
      }

      // Gerar roteiro
      const script = generateScript(context.briefing, sceneTypes, context.format)

      log(`Roteiro gerado: ${script.scenes.length} cenas, ${script.totalDuration}s total`)

      for (const scene of script.scenes) {
        log(`  Cena ${scene.type}: "${scene.title}" (${scene.duration}s)`, 'debug')
      }

      // Registrar prompts usados no trace
      trace.output = {
        totalScenes: script.scenes.length,
        totalDuration: script.totalDuration,
        scenes: script.scenes.map(s => ({
          type: s.type,
          title: s.title,
          hasVisualPrompt: !!s.visualPrompt,
          hasVideoPrompt: !!s.videoPrompt,
          narrationLength: s.narration.length,
        })),
      }

      trace.status = 'completed'
      trace.completedAt = new Date().toISOString()
      trace.promptUsed = script.scenes.map(s => `[${s.type}] Visual: ${s.visualPrompt?.slice(0, 80) || 'N/A'}...`).join('\n')

      log('Roteiro completo gerado com sucesso', 'success')

      return { success: true, data: script, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha ao gerar roteiro: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}
