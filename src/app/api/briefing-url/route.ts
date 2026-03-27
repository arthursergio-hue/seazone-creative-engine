// API route — extrai briefing de uma URL
import { NextRequest, NextResponse } from 'next/server'
import { extractBriefingFromUrl } from '@/lib/briefingExtractor'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body as { url?: string }

    if (!url) {
      return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 })
    }

    const result = await extractBriefingFromUrl(url)

    return NextResponse.json({
      success: result.success,
      briefing: result.briefing,
      rawText: result.rawText?.slice(0, 500),
      source: result.source,
      error: result.error,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
