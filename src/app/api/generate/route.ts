import { NextRequest, NextResponse } from 'next/server'
import { runPipeline, PipelineConfig } from '@/lib/pipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as PipelineConfig

    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const pipelineId = await runPipeline(body, baseUrl)

    return NextResponse.json({
      pipelineId,
      message: 'Pipeline iniciada! Gerando vídeos a partir das suas imagens.',
      statusUrl: `/api/status?id=${pipelineId}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
