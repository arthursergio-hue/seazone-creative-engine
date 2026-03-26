import { generateVideo, waitForVideo } from './freepik'

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
  status: 'queued' | 'generating_video' | 'completed' | 'failed'
  videoUrl?: string
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
  status: 'running' | 'completed' | 'failed'
  videos: VideoCreative[]
  startedAt: string
  completedAt?: string
}

const pipelines = new Map<string, PipelineStatus>()

export function getPipeline(id: string): PipelineStatus | undefined {
  return pipelines.get(id)
}

export function getAllPipelines(): PipelineStatus[] {
  return Array.from(pipelines.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
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
    })
  }

  if (videos.length === 0) {
    throw new Error('Nenhum vídeo pode ser gerado — verifique se as imagens correspondem aos tipos selecionados')
  }

  const pipeline: PipelineStatus = {
    id,
    briefing: config.briefingText || 'Novo Campeche SPOT II',
    status: 'running',
    videos,
    startedAt: new Date().toISOString(),
  }

  pipelines.set(id, pipeline)

  processVideos(pipeline, baseUrl).catch(err => {
    pipeline.status = 'failed'
    console.error('Pipeline failed:', err)
  })

  return id
}

async function processVideos(pipeline: PipelineStatus, baseUrl: string) {
  // Kling permite max 3 concorrentes — processar em batches de 2 para segurança
  const batchSize = 2
  for (let i = 0; i < pipeline.videos.length; i += batchSize) {
    const batch = pipeline.videos.slice(i, i + batchSize)

    await Promise.all(batch.map(async (video) => {
      try {
        video.status = 'generating_video'

        // A imagem precisa ser uma URL pública para a API Freepik acessar
        const imageUrl = video.sourceImage.startsWith('http')
          ? video.sourceImage
          : `${baseUrl}${video.sourceImage}`

        const { taskId } = await generateVideo(imageUrl, video.prompt, {
          duration: 5,
          aspectRatio: '9:16',
        })

        const videoUrl = await waitForVideo(taskId)
        video.videoUrl = videoUrl
        video.status = 'completed'
      } catch (err) {
        video.status = 'failed'
        video.error = err instanceof Error ? err.message : 'Erro desconhecido'
      }
    }))
  }

  pipeline.status = pipeline.videos.some(v => v.status === 'completed') ? 'completed' : 'failed'
  pipeline.completedAt = new Date().toISOString()
}
