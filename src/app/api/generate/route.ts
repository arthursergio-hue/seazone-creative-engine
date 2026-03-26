import { NextRequest, NextResponse } from 'next/server'
import { runPipeline, CreativeType } from '@/lib/pipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      types = ['fachada', 'localizacao', 'roi', 'rendimento', 'lifestyle'],
      briefing,
    } = body as { types?: CreativeType[]; briefing?: string }

    const validTypes: CreativeType[] = ['fachada', 'localizacao', 'roi', 'rendimento', 'lifestyle', 'rooftop', 'apresentadora']
    const filteredTypes = types.filter(t => validTypes.includes(t))

    if (filteredTypes.length === 0) {
      return NextResponse.json({ error: 'Nenhum tipo de criativo válido' }, { status: 400 })
    }

    const pipelineId = await runPipeline(filteredTypes, briefing)

    return NextResponse.json({
      pipelineId,
      message: 'Pipeline iniciada! Acompanhe o status.',
      statusUrl: `/api/status?id=${pipelineId}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
