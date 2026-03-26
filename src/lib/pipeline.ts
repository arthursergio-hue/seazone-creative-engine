import { generateVideo, waitForVideo, lipSync, waitForLipSync } from './freepik'
import { generateSpeech, generateScript } from './tts'

export interface UploadedAsset {
  url: string
  label: string
  category: 'fachada' | 'interior' | 'localizacao' | 'apresentadora' | 'rooftop' | 'outro'
}

export interface VideoCreative {
  id: string
  label: string
  sourceImage: string
  prompt: string
  status: 'queued' | 'generating_audio' | 'generating_video' | 'lip_syncing' | 'completed' | 'failed'
  videoUrl?: string
  audioUrl?: string
  needsLipSync: boolean
  error?: string
}

export type VideoType =
  | 'apresentadora_falando'
  | 'fachada_cinematic'
  | 'interior_tour'
  | 'localizacao_aerial'
  | 'rooftop_lifestyle'

export interface PipelineConfig {
  briefingText: string
  assets: UploadedAsset[]
  videoTypes: VideoType[]
}

export interface PipelineStatus {
  id: string
  briefing: string
  baseUrl: string
  status: 'running' | 'completed' | 'failed'
  videos: VideoCreative[]
  startedAt: string
  completedAt?: string
}

import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'

const PIPELINE_DIR = join('/tmp', 'pipelines')

function ensureDir() {
  try { mkdirSync(PIPELINE_DIR, { recursive: true }) } catch {}
}

function savePipeline(pipeline: PipelineStatus) {
  ensureDir()
  writeFileSync(join(PIPELINE_DIR, `${pipeline.id}.json`), JSON.stringify(pipeline))
}

function loadPipeline(id: string): PipelineStatus | undefined {
  try {
    const data = readFileSync(join(PIPELINE_DIR, `${id}.json`), 'utf-8')
    return JSON.parse(data)
  } catch {
    return undefined
  }
}

// Também manter em memória para o mesmo processo
const pipelines = new Map<string, PipelineStatus>()

export function getPipeline(id: string): PipelineStatus | undefined {
  return pipelines.get(id) || loadPipeline(id)
}

export function getAllPipelines(): PipelineStatus[] {
  ensureDir()
  try {
    const files = readdirSync(PIPELINE_DIR).filter(f => f.endsWith('.json'))
    const all = files.map(f => {
      try { return JSON.parse(readFileSync(join(PIPELINE_DIR, f), 'utf-8')) as PipelineStatus } catch { return null }
    }).filter(Boolean) as PipelineStatus[]
    return all.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  } catch {
    return Array.from(pipelines.values())
  }
}

const VIDEO_TYPE_CONFIG: Record<VideoType, { label: string; category: UploadedAsset['category']; prompt: string }> = {
  apresentadora_falando: {
    label: 'Mônica — apresentando o empreendimento',
    category: 'apresentadora',
    prompt: 'Woman speaking directly to camera with confident warm smile, subtle natural head movements and gestures, professional real estate presentation style, smooth gentle movement, bright clean background',
  },
  fachada_cinematic: {
    label: 'Fachada — vídeo cinematográfico',
    category: 'fachada',
    prompt: 'Slow cinematic upward camera tilt revealing modern apartment building facade, tropical plants swaying gently in breeze, warm golden hour lighting, professional real estate showcase, smooth camera movement',
  },
  interior_tour: {
    label: 'Interior — tour pelo apartamento',
    category: 'interior',
    prompt: 'Slow smooth camera pan across modern apartment interior, warm ambient lighting, gentle parallax movement revealing furniture details, premium real estate video tour, cozy atmosphere',
  },
  localizacao_aerial: {
    label: 'Localização — vista aérea',
    category: 'localizacao',
    prompt: 'Smooth aerial drone fly-over of coastal neighborhood, gentle descending camera movement revealing proximity to beach, golden hour lighting, cinematic real estate video',
  },
  rooftop_lifestyle: {
    label: 'Rooftop — piscina e lifestyle',
    category: 'rooftop',
    prompt: 'Slow panoramic camera sweep across rooftop pool area, water surface gently rippling, revealing city and ocean view in background, aspirational luxury lifestyle, warm golden lighting',
  },
}

export function getVideoTypeConfig() {
  return VIDEO_TYPE_CONFIG
}

export async function runPipeline(config: PipelineConfig, baseUrl: string): Promise<string> {
  const id = `pipeline_${Date.now()}`

  const videos: VideoCreative[] = []

  for (const videoType of config.videoTypes) {
    const typeConfig = VIDEO_TYPE_CONFIG[videoType]
    const asset = config.assets.find(a => a.category === typeConfig.category)
    if (!asset) continue

    videos.push({
      id: `${id}_${videoType}`,
      label: typeConfig.label,
      sourceImage: asset.url,
      prompt: typeConfig.prompt,
      status: 'queued',
      needsLipSync: videoType === 'apresentadora_falando',
    })
  }

  if (videos.length === 0) {
    throw new Error('Nenhum vídeo pode ser gerado — verifique se as imagens correspondem aos tipos selecionados')
  }

  const pipeline: PipelineStatus = {
    id,
    briefing: config.briefingText || 'Novo Campeche SPOT II',
    baseUrl,
    status: 'running',
    videos,
    startedAt: new Date().toISOString(),
  }

  pipelines.set(id, pipeline)
  savePipeline(pipeline)

  processVideos(pipeline).catch(err => {
    pipeline.status = 'failed'
    savePipeline(pipeline)
    console.error('Pipeline failed:', err)
  })

  return id
}

async function processVideos(pipeline: PipelineStatus) {
  const { baseUrl } = pipeline

  // Processar vídeos em batches de 2 (limite Kling = 3 concorrentes)
  const batchSize = 2
  for (let i = 0; i < pipeline.videos.length; i += batchSize) {
    const batch = pipeline.videos.slice(i, i + batchSize)

    await Promise.all(batch.map(async (video) => {
      try {
        // STEP 1: Se é a apresentadora, gerar áudio primeiro
        let audioPublicUrl: string | undefined
        if (video.needsLipSync) {
          video.status = 'generating_audio'
          savePipeline(pipeline)
          const script = generateScript({
            nome: pipeline.briefing,
            roi: '16,40%',
            rendimento: 'R$ 5.500',
            localizacao: 'Campeche, Florianópolis',
            valorizacao: '81%',
          })
          const audioPath = await generateSpeech(script, video.id)
          audioPublicUrl = `${baseUrl}${audioPath}`
          video.audioUrl = audioPath
        }

        // STEP 2: Gerar vídeo a partir da imagem
        video.status = 'generating_video'
        savePipeline(pipeline)

        const imageUrl = video.sourceImage.startsWith('http')
          ? video.sourceImage
          : `${baseUrl}${video.sourceImage}`

        const { taskId } = await generateVideo(imageUrl, video.prompt, {
          duration: video.needsLipSync ? 10 : 5,
          aspectRatio: '9:16',
        })

        const rawVideoUrl = await waitForVideo(taskId)

        // STEP 3: Se precisa de lip sync, sincronizar lábios com áudio
        if (video.needsLipSync && audioPublicUrl) {
          video.status = 'lip_syncing'
          savePipeline(pipeline)
          const { taskId: lsTaskId } = await lipSync(rawVideoUrl, audioPublicUrl)
          const syncedVideoUrl = await waitForLipSync(lsTaskId)
          video.videoUrl = syncedVideoUrl
        } else {
          video.videoUrl = rawVideoUrl
        }

        video.status = 'completed'
        savePipeline(pipeline)
      } catch (err) {
        video.status = 'failed'
        video.error = err instanceof Error ? err.message : 'Erro desconhecido'
        savePipeline(pipeline)
      }
    }))
  }

  pipeline.status = pipeline.videos.some(v => v.status === 'completed') ? 'completed' : 'failed'
  pipeline.completedAt = new Date().toISOString()
  savePipeline(pipeline)
}
