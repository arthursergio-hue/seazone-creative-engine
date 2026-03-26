import { generateImage, generateVideo, waitForImage, waitForVideo } from './freepik'
import { IMAGE_PROMPTS, VIDEO_PROMPTS, BRIEFING_SPOT_II, SEAZONE_CONTEXT } from '@/context/seazone'

export type CreativeType = 'fachada' | 'localizacao' | 'roi' | 'rendimento' | 'lifestyle' | 'rooftop' | 'apresentadora'

export interface CreativeResult {
  type: CreativeType
  label: string
  imageUrl: string
  videoUrl?: string
  status: 'generating_image' | 'generating_video' | 'completed' | 'failed'
  error?: string
}

export interface PipelineStatus {
  id: string
  briefing: string
  status: 'running' | 'completed' | 'failed'
  creatives: CreativeResult[]
  startedAt: string
  completedAt?: string
}

// Armazena pipelines em memória (em produção seria banco de dados)
const pipelines = new Map<string, PipelineStatus>()

export function getPipeline(id: string): PipelineStatus | undefined {
  return pipelines.get(id)
}

export function getAllPipelines(): PipelineStatus[] {
  return Array.from(pipelines.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
}

function buildPrompt(type: CreativeType, customBriefing?: string): string {
  const basePrompt = IMAGE_PROMPTS[type]
  const brandContext = `Style: premium, professional, clean. Colors: blue #0055FF, navy #00143D, coral #FC6058. Brand: Seazone.`

  if (customBriefing) {
    return `${basePrompt}. Context: ${customBriefing}. ${brandContext}`
  }
  return `${basePrompt}. ${brandContext}`
}

export async function runPipeline(
  types: CreativeType[],
  customBriefing?: string
): Promise<string> {
  const id = `pipeline_${Date.now()}`
  const pipeline: PipelineStatus = {
    id,
    briefing: customBriefing || BRIEFING_SPOT_II.empreendimento.nome,
    status: 'running',
    creatives: types.map(type => ({
      type,
      label: getLabelForType(type),
      imageUrl: '',
      status: 'generating_image' as const,
    })),
    startedAt: new Date().toISOString(),
  }

  pipelines.set(id, pipeline)

  // Executa geração em background (não bloqueia a resposta)
  processCreatives(pipeline, customBriefing).catch(err => {
    pipeline.status = 'failed'
    console.error('Pipeline failed:', err)
  })

  return id
}

async function processCreatives(pipeline: PipelineStatus, customBriefing?: string) {
  // Gerar todas as imagens em paralelo
  const imagePromises = pipeline.creatives.map(async (creative, index) => {
    try {
      const prompt = buildPrompt(creative.type, customBriefing)
      const { taskId } = await generateImage(prompt)
      const imageUrl = await waitForImage(taskId)
      creative.imageUrl = imageUrl
      creative.status = 'generating_video'
      return { index, imageUrl, success: true }
    } catch (err) {
      creative.status = 'failed'
      creative.error = err instanceof Error ? err.message : 'Erro desconhecido'
      return { index, imageUrl: '', success: false }
    }
  })

  const imageResults = await Promise.all(imagePromises)

  // Gerar vídeos a partir das imagens que deram certo
  const videoPromises = imageResults
    .filter(r => r.success)
    .map(async ({ index, imageUrl }) => {
      const creative = pipeline.creatives[index]
      try {
        const videoPrompt = VIDEO_PROMPTS[creative.type]
        const { taskId } = await generateVideo(imageUrl, videoPrompt)
        const videoUrl = await waitForVideo(taskId)
        creative.videoUrl = videoUrl
        creative.status = 'completed'
      } catch (err) {
        // Imagem OK mas vídeo falhou — ainda marca como completed (tem a imagem)
        creative.status = 'completed'
        creative.error = `Vídeo falhou: ${err instanceof Error ? err.message : 'Erro'}`
      }
    })

  await Promise.all(videoPromises)

  pipeline.status = pipeline.creatives.some(c => c.status === 'completed') ? 'completed' : 'failed'
  pipeline.completedAt = new Date().toISOString()
}

function getLabelForType(type: CreativeType): string {
  const labels: Record<CreativeType, string> = {
    fachada: 'Fachada do Empreendimento',
    localizacao: 'Localização Premium',
    roi: 'ROI 16,40%',
    rendimento: 'Rendimento R$ 5.500/mês',
    lifestyle: 'Interior do Studio',
    rooftop: 'Rooftop & Piscina',
    apresentadora: 'Apresentadora Seazone',
  }
  return labels[type]
}
