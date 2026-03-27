// Agent Pipeline — orquestra a execução dos 6 agentes em sequência

import type { AgentContext, AgentTrace, PipelineEvent, CreativeOutput, NarrationOutput, PieceOutput } from '@/agents/types'
import { EstrategistaCriativo } from '@/agents/EstrategistaCriativo'
import { GeradorDeRoteiro } from '@/agents/GeradorDeRoteiro'
import { CriadorDeCriativos } from '@/agents/CriadorDeCriativos'
import { GeradorDePecas } from '@/agents/GeradorDePecas'
import { GeradorDeNarracao } from '@/agents/GeradorDeNarracao'
import { ValidadorDeCriativos } from '@/agents/ValidadorDeCriativos'
import { pipelineLogger } from './pipelineLogger'
import { mergeBriefing, type BriefingData, type CreativeSceneType, type GeneratedScript } from './scriptGenerator'
import { generateSubtitle } from './scriptGenerator'
import { getPresenterProfile, getPresenterTraceInfo } from './presenterProfile'
import { CREATIVE_CATEGORIES, type OutputMode } from '@/context/seazone'
import type { PipelineStatus, CreativeResult, PresenterProfileSummary } from './pipeline'

export interface AgentPipelineResult {
  pipelineId: string
  status: 'completed' | 'failed'
  traces: AgentTrace[]
  pipeline: PipelineStatus
}

// Armazena pipelines em memória (compartilhado com sistema antigo)
const agentPipelines = new Map<string, PipelineStatus>()
const pipelineTraces = new Map<string, AgentTrace[]>()

export function getAgentPipeline(id: string): PipelineStatus | undefined {
  return agentPipelines.get(id)
}

export function getAgentPipelineTraces(id: string): AgentTrace[] {
  return pipelineTraces.get(id) || []
}

export async function runAgentPipeline(
  types: CreativeSceneType[],
  briefingData: Partial<BriefingData>,
  freeTextBriefing?: string,
  referenceImages?: Record<string, string>,
  aspectRatio?: string,
  outputMode?: OutputMode
): Promise<string> {
  const pipelineId = `agent_${Date.now()}`
  const format = aspectRatio || '9:16'
  const mode = outputMode || 'both'
  const briefing = mergeBriefing(briefingData, freeTextBriefing)
  const logger = pipelineLogger

  // Criar pipeline status inicial
  const pipeline: PipelineStatus = {
    id: pipelineId,
    briefing,
    script: { briefing, scenes: [], totalDuration: 0, format },
    outputMode: mode,
    status: 'running',
    creatives: [],
    startedAt: new Date().toISOString(),
  }
  agentPipelines.set(pipelineId, pipeline)

  // Contexto compartilhado entre agentes
  const context: AgentContext = {
    pipelineId,
    briefing,
    format,
    outputMode: mode,
    referenceImages,
  }

  // Executar pipeline em background
  executeAgentPipeline(pipelineId, pipeline, context, types, logger).catch(err => {
    pipeline.status = 'failed'
    logger.error(pipelineId, err instanceof Error ? err.message : 'Erro fatal no pipeline')
  })

  return pipelineId
}

async function executeAgentPipeline(
  pipelineId: string,
  pipeline: PipelineStatus,
  context: AgentContext,
  types: CreativeSceneType[],
  logger: typeof pipelineLogger
) {
  const traces: AgentTrace[] = []
  pipelineTraces.set(pipelineId, traces)

  function makeLog(agent: string) {
    return (msg: string, type: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info') => {
      logger.log(pipelineId, agent as any, msg, type)
    }
  }

  try {
    // =========================================
    // AGENTE 1: Estrategista Criativo (5% -> 15%)
    // =========================================
    logger.progress_update(pipelineId, 5, 'Definindo estratégia criativa...', 'EstrategistaCriativo')
    logger.agent_start(pipelineId, 'EstrategistaCriativo', 'Analisando briefing e definindo estratégia')

    const strategyResult = await EstrategistaCriativo.execute(context, context, makeLog('EstrategistaCriativo'))
    traces.push(strategyResult.trace)

    logger.agent_end(pipelineId, 'EstrategistaCriativo', strategyResult.success)

    if (strategyResult.success && strategyResult.data) {
      context.strategy = strategyResult.data
    }

    logger.progress_update(pipelineId, 15, 'Estratégia definida', 'EstrategistaCriativo')

    // =========================================
    // AGENTE 2: Gerador de Roteiro (15% -> 25%)
    // =========================================
    logger.progress_update(pipelineId, 18, 'Gerando roteiro...', 'GeradorDeRoteiro')
    logger.agent_start(pipelineId, 'GeradorDeRoteiro', 'Criando roteiro dinâmico do briefing')

    // Filtrar apenas tipos válidos pela estratégia
    if (context.strategy?.sceneOrder) {
      const strategyTypes = context.strategy.sceneOrder.filter(t => types.includes(t as CreativeSceneType))
      if (strategyTypes.length > 0) {
        // Usar ordem da estratégia mas limitado aos tipos selecionados
      }
    }

    const scriptResult = await GeradorDeRoteiro.execute(context, context, makeLog('GeradorDeRoteiro'))
    traces.push(scriptResult.trace)

    logger.agent_end(pipelineId, 'GeradorDeRoteiro', scriptResult.success)

    if (!scriptResult.success || !scriptResult.data) {
      pipeline.status = 'failed'
      logger.error(pipelineId, 'Falha ao gerar roteiro — pipeline cancelado', 'GeradorDeRoteiro')
      return
    }

    context.script = scriptResult.data
    pipeline.script = scriptResult.data

    // Montar criativos iniciais no pipeline
    const hasPresenter = types.includes('apresentadora')
    const presenterProfile = hasPresenter ? getPresenterProfile() : null
    const presenterTrace = hasPresenter ? getPresenterTraceInfo() : null

    pipeline.creatives = scriptResult.data.scenes.map(scene => ({
      type: scene.type,
      label: scene.title,
      imageUrl: '',
      status: 'generating_image' as const,
      isReference: CREATIVE_CATEGORIES.reference.includes(scene.type),
      isFixed: CREATIVE_CATEGORIES.fixed.includes(scene.type),
      isHtml: CREATIVE_CATEGORIES.html.includes(scene.type),
      scene,
      subtitle: generateSubtitle(scene.narration),
      presenterTrace: scene.type === 'apresentadora' && presenterTrace ? presenterTrace : undefined,
    }))

    if (presenterProfile) {
      pipeline.presenterProfile = {
        id: presenterProfile.id,
        name: presenterProfile.name,
        totalImageRefs: presenterProfile.imageReferences.length,
        totalVideoRefs: presenterProfile.videoReferences.length,
        preferredFaceFile: presenterProfile.preferredFaceReference?.filename || null,
        preferredVoiceFile: presenterProfile.preferredVoiceReference?.filename || null,
        voiceSupported: presenterProfile.voiceSupported,
        voiceSource: presenterProfile.voice.currentSource,
        sourceFolder: presenterProfile.sourceFolder,
      }
    }

    logger.progress_update(pipelineId, 25, 'Roteiro gerado', 'GeradorDeRoteiro')

    // =========================================
    // AGENTE 3: Criador de Criativos (25% -> 60%)
    // =========================================
    logger.progress_update(pipelineId, 28, 'Criando imagens e vídeos...', 'CriadorDeCriativos')
    logger.agent_start(pipelineId, 'CriadorDeCriativos', 'Gerando imagens e vídeos por IA')

    const creativesResult = await CriadorDeCriativos.execute(context, context, makeLog('CriadorDeCriativos'))
    traces.push(creativesResult.trace)

    logger.agent_end(pipelineId, 'CriadorDeCriativos', creativesResult.success)

    if (creativesResult.data) {
      context.creatives = creativesResult.data

      // Atualizar pipeline creatives com URLs geradas
      for (const generated of creativesResult.data) {
        const pipelineCreative = pipeline.creatives.find(c => c.type === generated.type)
        if (pipelineCreative) {
          pipelineCreative.imageUrl = generated.imageUrl
          pipelineCreative.videoUrl = generated.videoUrl
          pipelineCreative.status = generated.status === 'failed' ? 'failed' : 'completed'
          pipelineCreative.error = generated.error
        }
      }
    }

    logger.progress_update(pipelineId, 60, 'Criativos gerados', 'CriadorDeCriativos')

    // =========================================
    // AGENTE 4: Gerador de Peças (60% -> 70%)
    // =========================================
    logger.progress_update(pipelineId, 62, 'Gerando peças de texto...', 'GeradorDePecas')
    logger.agent_start(pipelineId, 'GeradorDePecas', 'Criando textos, overlays e hashtags')

    const piecesResult = await GeradorDePecas.execute(context, context, makeLog('GeradorDePecas'))
    traces.push(piecesResult.trace)

    logger.agent_end(pipelineId, 'GeradorDePecas', piecesResult.success)

    if (piecesResult.data) {
      context.pieces = piecesResult.data
    }

    logger.progress_update(pipelineId, 70, 'Peças de texto geradas', 'GeradorDePecas')

    // =========================================
    // AGENTE 5: Gerador de Narração (70% -> 85%)
    // =========================================
    logger.progress_update(pipelineId, 72, 'Gerando narrações...', 'GeradorDeNarracao')
    logger.agent_start(pipelineId, 'GeradorDeNarracao', 'Gerando áudio das narrações')

    const narrationResult = await GeradorDeNarracao.execute(context, context, makeLog('GeradorDeNarracao'))
    traces.push(narrationResult.trace)

    logger.agent_end(pipelineId, 'GeradorDeNarracao', narrationResult.success)

    if (narrationResult.data) {
      context.narrations = narrationResult.data
    }

    logger.progress_update(pipelineId, 85, 'Narrações geradas', 'GeradorDeNarracao')

    // =========================================
    // AGENTE 6: Validador (85% -> 95%)
    // =========================================
    logger.progress_update(pipelineId, 87, 'Validando criativos...', 'ValidadorDeCriativos')
    logger.agent_start(pipelineId, 'ValidadorDeCriativos', 'Verificando qualidade e alinhamento')

    const validationResult = await ValidadorDeCriativos.execute(context, context, makeLog('ValidadorDeCriativos'))
    traces.push(validationResult.trace)

    logger.agent_end(pipelineId, 'ValidadorDeCriativos', validationResult.success)

    if (validationResult.data) {
      context.validationResults = validationResult.data.results
      logger.validation(pipelineId, validationResult.data.results)
    }

    logger.progress_update(pipelineId, 95, 'Validação concluída', 'ValidadorDeCriativos')

    // =========================================
    // FINALIZAÇÃO
    // =========================================
    pipeline.status = pipeline.creatives.some(c => c.status === 'completed') ? 'completed' : 'failed'
    pipeline.completedAt = new Date().toISOString()

    logger.progress_update(pipelineId, 100, 'Pipeline finalizado')
    logger.complete(pipelineId, {
      totalCreatives: pipeline.creatives.length,
      completed: pipeline.creatives.filter(c => c.status === 'completed').length,
      validationScore: validationResult.data?.score,
      agents: traces.map(t => ({ name: t.agent, status: t.status })),
    })

    logger.cleanup(pipelineId)
  } catch (err) {
    pipeline.status = 'failed'
    pipeline.completedAt = new Date().toISOString()
    logger.error(pipelineId, err instanceof Error ? err.message : 'Erro fatal')
    logger.cleanup(pipelineId)
  }
}
