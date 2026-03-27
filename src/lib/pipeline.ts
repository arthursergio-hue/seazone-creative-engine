import { readFileSync } from 'fs'
import path from 'path'
import { generateImage, generateVideo, waitForImage, waitForVideo, uploadBase64Image } from './freepik'
import { generateClonedNarration } from './voiceClone'
import { generatePresenterVideo } from './lipsync'
import {
  generateScript,
  mergeBriefing,
  generateSubtitle,
  type BriefingData,
  type CreativeSceneType,
  type GeneratedScript,
  type SceneScript,
} from './scriptGenerator'
import { CREATIVE_CATEGORIES, SEAZONE_BRAND, MONICA_CONFIG, type OutputMode } from '@/context/seazone'
import { getPresenterProfile, getPresenterTraceInfo, type PresenterTraceInfo } from './presenterProfile'

export type CreativeType = CreativeSceneType

// Categorias de geração
const AI_TYPES = CREATIVE_CATEGORIES.aiGeneratable
const REFERENCE_TYPES = CREATIVE_CATEGORIES.reference
const HTML_TYPES = CREATIVE_CATEGORIES.html
const FIXED_TYPES = CREATIVE_CATEGORIES.fixed

export interface CreativeResult {
  type: CreativeType
  label: string
  imageUrl: string
  videoUrl?: string
  audioUrl?: string // áudio da narração (voz clonada)
  isLipSync?: boolean // true se o vídeo é lip-sync real (Mônica falando)
  status: 'generating_image' | 'generating_video' | 'generating_lipsync' | 'completed' | 'failed'
  error?: string
  isReference?: boolean
  isFixed?: boolean
  isHtml?: boolean
  scene?: SceneScript
  subtitle?: string
  presenterTrace?: PresenterTraceInfo
}

export interface PresenterProfileSummary {
  id: string
  name: string
  totalImageRefs: number
  totalVideoRefs: number
  preferredFaceFile: string | null
  preferredVoiceFile: string | null
  voiceSupported: boolean
  voiceSource: string
  sourceFolder: string
}

export interface PipelineStatus {
  id: string
  briefing: BriefingData
  script: GeneratedScript
  outputMode: OutputMode
  status: 'running' | 'completed' | 'failed'
  creatives: CreativeResult[]
  startedAt: string
  completedAt?: string
  // Perfil da apresentadora usado neste pipeline (quando há cena de apresentadora)
  presenterProfile?: PresenterProfileSummary
}

// Armazena pipelines em memória
const pipelines = new Map<string, PipelineStatus>()

export function getPipeline(id: string): PipelineStatus | undefined {
  return pipelines.get(id)
}

export function getAllPipelines(): PipelineStatus[] {
  return Array.from(pipelines.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
}

export interface ReferenceImages {
  fachada?: string
  lifestyle?: string
  rooftop?: string
  localizacao?: string
}

function buildPrompt(scene: SceneScript, brandContext: string): string {
  if (!scene.visualPrompt) return ''
  return `${scene.visualPrompt}. ${brandContext}`
}

export async function runPipeline(
  types: CreativeType[],
  briefingData: Partial<BriefingData>,
  freeTextBriefing?: string,
  referenceImages?: ReferenceImages,
  aspectRatio?: string,
  outputMode?: OutputMode
): Promise<string> {
  const id = `pipeline_${Date.now()}`
  const format = aspectRatio || '9:16'
  const mode = outputMode || 'both'

  // 1. Montar briefing completo (estruturado + texto livre)
  const briefing = mergeBriefing(briefingData, freeTextBriefing)

  // 2. Gerar roteiro dinâmico baseado no briefing
  const script = generateScript(briefing, types, format)

  // 2.5. Carregar perfil da apresentadora (se houver cena de apresentadora)
  const hasPresenter = types.includes('apresentadora')
  const presenterProfile = hasPresenter ? getPresenterProfile() : null
  const presenterTrace = hasPresenter ? getPresenterTraceInfo() : null

  // 3. Criar pipeline com dados do roteiro
  const pipeline: PipelineStatus = {
    id,
    briefing,
    script,
    outputMode: mode,
    status: 'running',
    creatives: script.scenes.map(scene => ({
      type: scene.type,
      label: scene.title,
      imageUrl: '',
      status: 'generating_image' as const,
      isReference: REFERENCE_TYPES.includes(scene.type) || (AI_TYPES.includes(scene.type) && hasReference(scene.type, referenceImages)),
      isFixed: FIXED_TYPES.includes(scene.type),
      isHtml: HTML_TYPES.includes(scene.type),
      scene,
      subtitle: generateSubtitle(scene.narration),
      // Injetar rastreabilidade da apresentadora na cena da Mônica
      presenterTrace: scene.type === 'apresentadora' && presenterTrace ? presenterTrace : undefined,
    })),
    startedAt: new Date().toISOString(),
    // Resumo do perfil da apresentadora para esta pipeline
    presenterProfile: presenterProfile ? {
      id: presenterProfile.id,
      name: presenterProfile.name,
      totalImageRefs: presenterProfile.imageReferences.length,
      totalVideoRefs: presenterProfile.videoReferences.length,
      preferredFaceFile: presenterProfile.preferredFaceReference?.filename || null,
      preferredVoiceFile: presenterProfile.preferredVoiceReference?.filename || null,
      voiceSupported: presenterProfile.voiceSupported,
      voiceSource: presenterProfile.voice.currentSource,
      sourceFolder: presenterProfile.sourceFolder,
    } : undefined,
  }

  pipelines.set(id, pipeline)

  processCreatives(pipeline, referenceImages, mode).catch(err => {
    pipeline.status = 'failed'
    console.error('Pipeline failed:', err)
  })

  return id
}

function hasReference(type: CreativeType, refs?: ReferenceImages): boolean {
  if (!refs) return false
  return !!(refs as Record<string, string | undefined>)[type]
}

async function processCreatives(
  pipeline: PipelineStatus,
  referenceImages?: ReferenceImages,
  outputMode: OutputMode = 'both'
) {
  const brandContext = `Style: premium, professional, clean. Colors: blue ${SEAZONE_BRAND.colors.primary}, navy ${SEAZONE_BRAND.colors.secondary}, coral ${SEAZONE_BRAND.colors.accent}. Brand: Seazone. Format: ${pipeline.script.format}.`

  // === FASE 1: GERAR IMAGENS ===
  const imagePromises = pipeline.creatives.map(async (creative, index) => {
    try {
      const scene = creative.scene!

      // HTML types (roi/rendimento): renderizados no frontend
      if (HTML_TYPES.includes(creative.type)) {
        creative.status = outputMode === 'videos' ? 'generating_video' : 'completed'
        creative.isHtml = true
        return { index, imageUrl: '', success: outputMode !== 'images' }
      }

      // Referência: usa imagem uploadada
      if (referenceImages) {
        const refImage = (referenceImages as Record<string, string | undefined>)[creative.type]
        if (refImage) {
          let publicUrl = refImage
          if (refImage.startsWith('data:')) {
            try {
              publicUrl = await uploadBase64Image(refImage)
            } catch {
              console.warn(`[Pipeline] Upload failed for ${creative.type}, using base64`)
            }
          }
          creative.imageUrl = publicUrl
          creative.status = outputMode === 'images' ? 'completed' : 'generating_video'
          creative.isReference = true
          return { index, imageUrl: publicUrl, success: true }
        }
      }

      // Mônica: foto real com composição — usa PresenterProfile como referência
      // REGRA: nunca gerar "outra mulher parecida" por IA.
      // Sempre usar foto/vídeo real da pasta de referência.
      // Fallback permitido: apenas entre arquivos da própria pasta da Mônica.
      if (FIXED_TYPES.includes(creative.type)) {
        const profile = getPresenterProfile()
        creative.imageUrl = profile.staticImagePath // /monica.png — foto estática
        creative.isFixed = true
        creative.status = outputMode === 'images' ? 'completed' : 'generating_video'
        console.log(`[Pipeline] Cena apresentadora: usando referência da Mônica`)
        console.log(`  - Perfil: ${profile.id} (${profile.name})`)
        console.log(`  - Refs visuais: ${profile.imageReferences.length} imagens, ${profile.videoReferences.length} vídeos`)
        console.log(`  - Face preferida: ${profile.preferredFaceReference?.filename || 'N/A'}`)
        console.log(`  - Voz: ${profile.voice.currentSource} (clonagem: ${profile.voice.cloningSupported ? 'SIM' : 'NÃO'})`)
        return { index, imageUrl: profile.staticImagePath, success: true }
      }

      // Geração por IA (localizacao, rooftop sem referência)
      if (AI_TYPES.includes(creative.type)) {
        const prompt = buildPrompt(scene, brandContext)
        if (!prompt) {
          creative.status = 'failed'
          creative.error = 'Sem prompt visual definido para este tipo'
          return { index, imageUrl: '', success: false }
        }
        const { taskId } = await generateImage(prompt, { aspectRatio: pipeline.script.format })
        const imageUrl = await waitForImage(taskId)
        creative.imageUrl = imageUrl
        creative.status = outputMode === 'images' ? 'completed' : 'generating_video'
        return { index, imageUrl, success: true }
      }

      // Tipo de referência sem imagem uploadada: tentar gerar por IA com prompt do roteiro
      if (REFERENCE_TYPES.includes(creative.type) && scene.visualPrompt) {
        const prompt = buildPrompt(scene, brandContext)
        const { taskId } = await generateImage(prompt, { aspectRatio: pipeline.script.format })
        const imageUrl = await waitForImage(taskId)
        creative.imageUrl = imageUrl
        creative.status = outputMode === 'images' ? 'completed' : 'generating_video'
        return { index, imageUrl, success: true }
      }

      creative.status = 'failed'
      creative.error = 'Imagem de referência não enviada'
      return { index, imageUrl: '', success: false }
    } catch (err) {
      creative.status = 'failed'
      creative.error = err instanceof Error ? err.message : 'Erro desconhecido'
      return { index, imageUrl: '', success: false }
    }
  })

  const imageResults = await Promise.all(imagePromises)

  // === FASE 2: GERAR VÍDEOS (se modo não for 'images') ===
  if (outputMode !== 'images') {
    const videoPromises = imageResults
      .filter(r => r.success && r.imageUrl)
      .map(async ({ index, imageUrl }) => {
        const creative = pipeline.creatives[index]
        const scene = creative.scene!
        let videoImageUrl = imageUrl

        try {
          // === APRESENTADORA: LIP-SYNC (ela realmente falando) ===
          if (FIXED_TYPES.includes(creative.type) && scene.narration) {
            creative.status = 'generating_lipsync'
            console.log('[Pipeline] Gerando lip-sync da Mônica com voz clonada...')

            try {
              // 1. Clonar voz da Mônica para esta narração
              const audioBuffer = await generateClonedNarration(scene.narration)
              creative.audioUrl = `data:audio/wav;base64,${audioBuffer.toString('base64')}`

              // 2. Gerar vídeo lip-sync (foto + áudio = Mônica falando)
              const lipSyncVideoUrl = await generatePresenterVideo(audioBuffer)
              creative.videoUrl = lipSyncVideoUrl
              creative.isLipSync = true
              creative.status = 'completed'
              console.log('[Pipeline] Lip-sync da Mônica gerado com sucesso!')
              return
            } catch (lipSyncErr) {
              console.warn('[Pipeline] Lip-sync falhou, tentando fallback (vídeo normal):', lipSyncErr)
              // Fallback: vídeo normal da foto com câmera
            }
          }

          // === DEMAIS CENAS: vídeo normal (imagem → vídeo com câmera) ===

          // Mônica fallback: ler arquivo local, fazer upload para URL pública
          if (videoImageUrl === MONICA_CONFIG.imagePath) {
            try {
              const filePath = path.join(process.cwd(), 'public', 'monica.png')
              const buffer = readFileSync(filePath)
              const base64 = `data:image/png;base64,${buffer.toString('base64')}`
              videoImageUrl = await uploadBase64Image(base64)
            } catch (uploadErr) {
              console.warn('[Pipeline] Failed to upload monica.png:', uploadErr)
              creative.status = 'completed'
              return
            }
          }

          // Skip se URL não é pública
          if (videoImageUrl.startsWith('/') || videoImageUrl.startsWith('data:')) {
            creative.status = 'completed'
            return
          }

          creative.status = 'generating_video'
          const videoPrompt = scene.videoPrompt
          if (!videoPrompt) {
            creative.status = 'completed'
            return
          }

          const { taskId } = await generateVideo(videoImageUrl, videoPrompt, {
            duration: 5,
            aspectRatio: pipeline.script.format,
          })
          const videoUrl = await waitForVideo(taskId)
          creative.videoUrl = videoUrl
          creative.status = 'completed'
        } catch (err) {
          creative.status = 'completed'
          creative.error = `Vídeo falhou: ${err instanceof Error ? err.message : 'Erro'}`
        }
      })

    await Promise.all(videoPromises)
  }

  pipeline.status = pipeline.creatives.some(c => c.status === 'completed') ? 'completed' : 'failed'
  pipeline.completedAt = new Date().toISOString()
}
