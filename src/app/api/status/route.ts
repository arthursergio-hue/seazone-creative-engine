import { NextRequest, NextResponse } from 'next/server'
import { getPipeline, getAllPipelines } from '@/lib/pipeline'
import { getAgentPipeline, getAgentPipelineTraces } from '@/lib/agentPipeline'
import { pipelineLogger } from '@/lib/pipelineLogger'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    // Tentar pipeline de agentes primeiro, depois o antigo
    const agentPipeline = getAgentPipeline(id)
    if (agentPipeline) {
      const traces = getAgentPipelineTraces(id)
      const progress = pipelineLogger.getProgress(id)
      const history = pipelineLogger.getHistory(id)

      return NextResponse.json({
        ...agentPipeline,
        agentMode: true,
        progress,
        traces: traces.map(t => ({
          agent: t.agent,
          status: t.status,
          startedAt: t.startedAt,
          completedAt: t.completedAt,
          error: t.error,
          filesGenerated: t.filesGenerated,
          promptUsed: t.promptUsed,
        })),
        logs: history.slice(-50).map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          progress: e.progress,
          agent: e.currentAgent,
          step: e.currentStep,
          log: e.log,
          data: e.data,
        })),
      })
    }

    const pipeline = getPipeline(id)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ ...pipeline, agentMode: false })
  }

  return NextResponse.json(getAllPipelines())
}
