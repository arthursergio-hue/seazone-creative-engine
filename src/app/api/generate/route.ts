import { NextRequest, NextResponse } from 'next/server'
import { runAgentPipeline } from '@/lib/agentPipeline'
import type { CreativeSceneType, BriefingData } from '@/lib/scriptGenerator'
import type { OutputMode } from '@/context/seazone'

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Requisição inválida — payload muito grande ou JSON malformado' }, { status: 400 })
    }

    const {
      types = ['localizacao', 'roi', 'rendimento', 'apresentadora'],
      briefing,
      freeTextBriefing,
      referenceImages,
      aspectRatio,
      outputMode = 'both',
    } = body as {
      types?: CreativeSceneType[]
      briefing?: Partial<BriefingData>
      freeTextBriefing?: string
      referenceImages?: Record<string, string>
      aspectRatio?: string
      outputMode?: OutputMode
    }

    const validTypes: CreativeSceneType[] = ['fachada', 'localizacao', 'roi', 'rendimento', 'lifestyle', 'rooftop', 'apresentadora']
    const filteredTypes = types.filter(t => validTypes.includes(t))

    if (filteredTypes.length === 0) {
      return NextResponse.json({ error: 'Nenhum tipo de criativo válido' }, { status: 400 })
    }

    // Pipeline baseado em agentes inteligentes
    const pipelineId = await runAgentPipeline(
      filteredTypes,
      briefing || {},
      freeTextBriefing,
      referenceImages,
      aspectRatio,
      outputMode
    )

    return NextResponse.json({
      pipelineId,
      message: 'Pipeline de agentes iniciado! Roteiro gerado a partir do briefing.',
      statusUrl: `/api/status?id=${pipelineId}`,
      eventsUrl: `/api/pipeline/events?id=${pipelineId}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
