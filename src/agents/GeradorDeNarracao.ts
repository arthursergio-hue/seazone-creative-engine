// Agente 5: Gerador de Narração
// Gera narração em áudio para cada cena usando TTS ou voz clonada

import type { Agent, AgentContext, AgentResult, AgentTrace, NarrationOutput, AgentLogEntry } from './types'
import { generateVoice, getVoiceInfo } from '@/lib/voiceService'

export const GeradorDeNarracao: Agent<AgentContext, NarrationOutput[]> = {
  name: 'GeradorDeNarracao',
  description: 'Gera narração em áudio para cada cena, usando voz clonada (ElevenLabs) ou TTS genérico como fallback.',

  async execute(input, context, log): Promise<AgentResult<NarrationOutput[]>> {
    const trace: AgentTrace = {
      agent: 'GeradorDeNarracao' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { sceneCount: context.script?.scenes.length },
      logs: [] as AgentLogEntry[],
      filesGenerated: [] as string[],
    }

    try {
      const script = context.script
      if (!script) throw new Error('Roteiro não disponível')

      const voiceInfo = getVoiceInfo()
      log(`Provider de voz: ${voiceInfo.provider} (${voiceInfo.isMonicaVoice ? 'Voz da Mônica' : 'TTS genérico'})`)

      if (!voiceInfo.isMonicaVoice) {
        log('Voz clonada não disponível — usando TTS genérico como fallback', 'warning')
      }

      const narrations: NarrationOutput[] = []

      for (const scene of script.scenes) {
        if (!scene.narration) {
          log(`  ${scene.type}: sem narração definida`, 'debug')
          continue
        }

        try {
          log(`  ${scene.type}: gerando narração... ("${scene.narration.slice(0, 50)}...")`)

          const result = await generateVoice(scene.narration)

          narrations.push({
            type: scene.type,
            text: scene.narration,
            audioBase64: result.audioBase64,
            provider: result.provider,
            isMonicaVoice: result.isMonicaVoice,
          })

          log(`  ${scene.type}: narração gerada (${result.provider})`, 'success')
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro'
          log(`  ${scene.type}: falha na narração — ${errMsg}`, 'error')
          narrations.push({
            type: scene.type,
            text: scene.narration,
            provider: 'none',
            isMonicaVoice: false,
          })
        }
      }

      const success = narrations.filter(n => n.audioBase64).length
      log(`Narrações: ${success}/${narrations.length} geradas com sucesso`)

      trace.status = 'completed'
      trace.completedAt = new Date().toISOString()
      trace.output = { total: narrations.length, success, provider: voiceInfo.provider }

      log('Geração de narrações finalizada', 'success')
      return { success: true, data: narrations, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}
