// Agente 3: Criador de Criativos
// Gera imagens e vídeos a partir do roteiro usando Fal.ai

import type { Agent, AgentContext, AgentResult, AgentTrace, CreativeOutput, AgentLogEntry } from './types'
import { generateImage, generateVideo, waitForImage, waitForVideo, uploadBase64Image } from '@/lib/freepik'
import { CREATIVE_CATEGORIES, SEAZONE_BRAND, MONICA_CONFIG } from '@/context/seazone'
import { getPresenterProfile } from '@/lib/presenterProfile'
import { readFileSync } from 'fs'
import path from 'path'
import type { SceneScript } from '@/lib/scriptGenerator'

const AI_TYPES = CREATIVE_CATEGORIES.aiGeneratable
const REFERENCE_TYPES = CREATIVE_CATEGORIES.reference
const HTML_TYPES = CREATIVE_CATEGORIES.html
const FIXED_TYPES = CREATIVE_CATEGORIES.fixed

export const CriadorDeCriativos: Agent<AgentContext, CreativeOutput[]> = {
  name: 'CriadorDeCriativos',
  description: 'Gera imagens e vídeos para cada cena do roteiro usando IA (Fal.ai) ou referências.',

  async execute(input, context, log): Promise<AgentResult<CreativeOutput[]>> {
    const trace: AgentTrace = {
      agent: 'CriadorDeCriativos' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { sceneCount: context.script?.scenes.length, outputMode: context.outputMode },
      logs: [] as AgentLogEntry[],
      filesGenerated: [] as string[],
    }

    try {
      const script = context.script
      if (!script) {
        throw new Error('Roteiro não disponível — agente anterior falhou')
      }

      const creatives: CreativeOutput[] = []
      const brandContext = `Style: premium, professional, clean. Colors: blue ${SEAZONE_BRAND.colors.primary}, navy ${SEAZONE_BRAND.colors.secondary}, coral ${SEAZONE_BRAND.colors.accent}. Brand: Seazone. Format: ${script.format}.`

      // FASE 1: Imagens
      log(`Gerando imagens para ${script.scenes.length} cenas...`)

      for (const scene of script.scenes) {
        const creative: CreativeOutput = {
          type: scene.type,
          imageUrl: '',
          status: 'completed',
        }

        try {
          // HTML (roi/rendimento)
          if (HTML_TYPES.includes(scene.type)) {
            log(`  ${scene.type}: renderizado como HTML (frontend)`, 'debug')
            creative.imageUrl = 'html'
            creatives.push(creative)
            continue
          }

          // Referência upload
          if (context.referenceImages?.[scene.type]) {
            log(`  ${scene.type}: usando imagem de referência`)
            let url = context.referenceImages[scene.type]
            if (url.startsWith('data:')) {
              try {
                url = await uploadBase64Image(url)
              } catch {
                log(`  ${scene.type}: upload falhou, usando base64`, 'warning')
              }
            }
            creative.imageUrl = url
            creative.prompt = 'Referência enviada pelo usuário'
            creatives.push(creative)
            continue
          }

          // Foto real da Mônica
          if (FIXED_TYPES.includes(scene.type)) {
            const profile = getPresenterProfile()
            creative.imageUrl = profile.staticImagePath
            creative.prompt = 'Foto real da apresentadora (não gerada por IA)'
            log(`  ${scene.type}: foto real da ${profile.name}`)
            creatives.push(creative)
            continue
          }

          // Geração por IA
          if (AI_TYPES.includes(scene.type) || (REFERENCE_TYPES.includes(scene.type) && scene.visualPrompt)) {
            const prompt = `${scene.visualPrompt}. ${brandContext}`
            creative.prompt = prompt
            log(`  ${scene.type}: gerando imagem por IA...`)

            const { taskId } = await generateImage(prompt, { aspectRatio: script.format })
            const imageUrl = await waitForImage(taskId)
            creative.imageUrl = imageUrl
            trace.filesGenerated!.push(imageUrl)
            log(`  ${scene.type}: imagem gerada`, 'success')
          } else {
            creative.status = 'failed'
            creative.error = 'Sem referência e sem prompt visual'
            log(`  ${scene.type}: sem referência ou prompt`, 'warning')
          }
        } catch (err) {
          creative.status = 'failed'
          creative.error = err instanceof Error ? err.message : 'Erro'
          log(`  ${scene.type}: falha na imagem — ${creative.error}`, 'error')
        }

        creatives.push(creative)
      }

      const successImages = creatives.filter(c => c.status === 'completed' && c.imageUrl && c.imageUrl !== 'html').length
      log(`Imagens: ${successImages}/${script.scenes.length} geradas com sucesso`)

      // FASE 2: Vídeos (se modo não for 'images')
      if (context.outputMode !== 'images') {
        log('Gerando vídeos a partir das imagens...')

        for (const creative of creatives) {
          if (creative.status !== 'completed' || !creative.imageUrl || creative.imageUrl === 'html') continue

          const scene = script.scenes.find(s => s.type === creative.type)
          if (!scene?.videoPrompt) continue

          try {
            let videoImageUrl = creative.imageUrl

            // Mônica: upload local
            if (videoImageUrl === MONICA_CONFIG.imagePath) {
              try {
                const filePath = path.join(process.cwd(), 'public', 'monica.png')
                const buffer = readFileSync(filePath)
                const base64 = `data:image/png;base64,${buffer.toString('base64')}`
                videoImageUrl = await uploadBase64Image(base64)
              } catch {
                log(`  ${scene.type}: falha upload monica.png, pulando vídeo`, 'warning')
                continue
              }
            }

            if (videoImageUrl.startsWith('/') || videoImageUrl.startsWith('data:')) continue

            log(`  ${scene.type}: gerando vídeo...`)
            const { taskId } = await generateVideo(videoImageUrl, scene.videoPrompt, {
              duration: 5,
              aspectRatio: script.format,
            })
            const videoUrl = await waitForVideo(taskId)
            creative.videoUrl = videoUrl
            trace.filesGenerated!.push(videoUrl)
            log(`  ${scene.type}: vídeo gerado`, 'success')
          } catch (err) {
            creative.error = `Vídeo falhou: ${err instanceof Error ? err.message : 'Erro'}`
            log(`  ${scene.type}: ${creative.error}`, 'error')
          }
        }

        const successVideos = creatives.filter(c => c.videoUrl).length
        log(`Vídeos: ${successVideos} gerados com sucesso`)
      }

      trace.status = 'completed'
      trace.completedAt = new Date().toISOString()
      trace.output = {
        total: creatives.length,
        images: creatives.filter(c => c.imageUrl).length,
        videos: creatives.filter(c => c.videoUrl).length,
        failed: creatives.filter(c => c.status === 'failed').length,
      }

      log('Criação de criativos finalizada', 'success')
      return { success: true, data: creatives, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha geral: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}
