import { NextRequest, NextResponse } from 'next/server'
import { generateNarrationBase64 } from '@/lib/tts'
import { generateClonedNarrationBase64 } from '@/lib/voiceClone'
import { getPipeline } from '@/lib/pipeline'
import { generateSubtitle } from '@/lib/scriptGenerator'

interface ComposeRequest {
  mode: 'individual' | 'full'
  pipelineId?: string // para buscar roteiro dinâmico
  type?: string
  videoUrl?: string
  clips?: Array<{ type: string; videoUrl: string }>
}

interface ComposeResult {
  type: string
  videoUrl: string
  narrationAudio: string
  overlay: { title: string; subtitle: string }
  narrationText: string
  subtitleText: string // legenda resumida para exibir no vídeo
}

// Jobs em memória
const composeJobs = new Map<string, {
  status: 'processing' | 'completed' | 'failed'
  results: ComposeResult[]
  sequence: string[]
  error?: string
}>()

export function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('id')
  if (jobId) {
    const job = composeJobs.get(jobId)
    if (!job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
    return NextResponse.json(job)
  }
  const all = Array.from(composeJobs.entries()).map(([id, job]) => ({ id, ...job }))
  return NextResponse.json(all)
}

export async function POST(request: NextRequest) {
  let body: ComposeRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }
  const jobId = `compose_${Date.now()}`

  composeJobs.set(jobId, { status: 'processing', results: [], sequence: [] })

  processCompose(jobId, body).catch(err => {
    const job = composeJobs.get(jobId)
    if (job) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : 'Erro desconhecido'
    }
  })

  return NextResponse.json({
    jobId,
    message: 'Composição iniciada — gerando narrações do roteiro dinâmico...',
    statusUrl: `/api/compose?id=${jobId}`,
  })
}

async function processCompose(jobId: string, body: ComposeRequest) {
  const job = composeJobs.get(jobId)!

  // Buscar roteiro dinâmico do pipeline se disponível
  const pipeline = body.pipelineId ? getPipeline(body.pipelineId) : undefined

  const clipsToProcess = body.mode === 'individual' && body.type && body.videoUrl
    ? [{ type: body.type, videoUrl: body.videoUrl }]
    : body.clips || []

  if (clipsToProcess.length === 0) {
    throw new Error('Nenhum clip para processar')
  }

  for (const clip of clipsToProcess) {
    // Buscar dados da cena no roteiro dinâmico
    const sceneData = pipeline?.creatives.find(c => c.type === clip.type)?.scene

    // Overlay e narração vêm do roteiro dinâmico (não hardcoded)
    const overlay = sceneData
      ? sceneData.screenText
      : { title: clip.type.toUpperCase(), subtitle: '' }

    const narrationText = sceneData?.narration || ''
    const subtitleText = sceneData
      ? generateSubtitle(sceneData.narration)
      : ''

    let narrationAudio = ''
    if (narrationText) {
      try {
        // Tentar voz clonada da Mônica primeiro, fallback para TTS genérico
        const hasFalKey = !!(process.env.FAL_KEY || process.env.FREEPIK_API_KEY)
        if (hasFalKey) {
          narrationAudio = await generateClonedNarrationBase64(narrationText)
        } else {
          narrationAudio = await generateNarrationBase64(narrationText)
        }
      } catch (err) {
        console.error(`Voice clone failed for ${clip.type}, falling back to TTS:`, err)
        try {
          narrationAudio = await generateNarrationBase64(narrationText)
        } catch (ttsErr) {
          console.error(`TTS also failed for ${clip.type}:`, ttsErr)
        }
      }
    }

    job.results.push({
      type: clip.type,
      videoUrl: clip.videoUrl,
      narrationAudio,
      overlay: { title: overlay.title, subtitle: overlay.subtitle || '' },
      narrationText,
      subtitleText,
    })
  }

  // Sequência baseada no roteiro
  if (pipeline) {
    job.sequence = pipeline.script.scenes
      .filter(s => clipsToProcess.some(c => c.type === s.type))
      .map(s => s.type)
  } else {
    job.sequence = clipsToProcess.map(c => c.type)
  }

  job.status = 'completed'
}
