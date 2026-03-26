import { NextRequest, NextResponse } from 'next/server'
import { getPipeline, getAllPipelines } from '@/lib/pipeline'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const pipeline = getPipeline(id)
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }
    return NextResponse.json(pipeline)
  }

  // Lista todas as pipelines
  return NextResponse.json(getAllPipelines())
}
