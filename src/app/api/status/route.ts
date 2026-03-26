import { NextRequest, NextResponse } from 'next/server'
import { getVideoResult, lipSync, getLipSyncResult } from '@/lib/freepik'

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  const type = req.nextUrl.searchParams.get('type') || 'video' // 'video' ou 'lipsync'

  if (!taskId) {
    return NextResponse.json({ error: 'taskId obrigatório' }, { status: 400 })
  }

  try {
    if (type === 'lipsync') {
      const result = await getLipSyncResult(taskId)
      return NextResponse.json(result)
    } else {
      const result = await getVideoResult(taskId)
      return NextResponse.json(result)
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao verificar status' },
      { status: 500 }
    )
  }
}

// Endpoint para iniciar lip sync depois que o vídeo ficou pronto
export async function POST(req: NextRequest) {
  try {
    const { videoUrl, audioUrl } = await req.json()

    if (!videoUrl || !audioUrl) {
      return NextResponse.json({ error: 'videoUrl e audioUrl obrigatórios' }, { status: 400 })
    }

    const { taskId } = await lipSync(videoUrl, audioUrl)
    return NextResponse.json({ taskId, status: 'lip_syncing' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro no lip sync' },
      { status: 500 }
    )
  }
}
