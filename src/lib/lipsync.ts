// ============================================================
// LIP-SYNC — Gera vídeo da Mônica realmente falando
// ============================================================
// Usa modelo de lip-sync via Fal.ai para animar a foto da Mônica
// com o áudio da voz clonada, criando um vídeo realista
// de apresentação com áudio sincronizado.
// ============================================================

import { readFileSync, existsSync } from 'fs'
import path from 'path'

const QUEUE_BASE = 'https://queue.fal.run'

function getApiKey(): string {
  const key = process.env.FAL_KEY || process.env.FREEPIK_API_KEY
  if (!key) throw new Error('FAL_KEY não configurada')
  return key
}

function authHeaders() {
  return {
    'Authorization': `Key ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(`Resposta inesperada (${res.status}): ${text.slice(0, 200)}`) }
}

/**
 * Upload de imagem local para Fal.ai storage
 */
async function uploadImageToFal(imagePath: string): Promise<string> {
  const buffer = readFileSync(imagePath)
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

  const res = await fetch('https://fal.run/fal-ai/any-llm/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${getApiKey()}`,
      'Content-Type': mimeType,
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) throw new Error(`Upload imagem falhou: ${res.status}`)
  const data = await safeJson(res)
  return data.url
}

/**
 * Upload de buffer de áudio para Fal.ai storage
 */
async function uploadAudioToFal(audioBuffer: Buffer, mimeType = 'audio/wav'): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/any-llm/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${getApiKey()}`,
      'Content-Type': mimeType,
    },
    body: new Uint8Array(audioBuffer),
  })

  if (!res.ok) throw new Error(`Upload áudio falhou: ${res.status}`)
  const data = await safeJson(res)
  return data.url
}

/**
 * Gera vídeo da Mônica falando com lip-sync
 *
 * Usa SadTalker via Fal.ai: foto + áudio → vídeo com lábios sincronizados
 *
 * @param faceImageUrl - URL da foto da Mônica (Fal.ai storage)
 * @param audioBuffer - Buffer do áudio da narração (voz clonada)
 * @returns URL do vídeo gerado
 */
export async function generateLipSyncVideo(
  faceImageUrl: string,
  audioBuffer: Buffer,
): Promise<string> {
  console.log('[LipSync] Gerando vídeo lip-sync da Mônica...')

  // Upload do áudio para Fal.ai
  const audioUrl = await uploadAudioToFal(audioBuffer)
  console.log('[LipSync] Áudio uploaded:', audioUrl.slice(0, 60))

  // Usar SadTalker para gerar vídeo com lip-sync
  const res = await fetch(`${QUEUE_BASE}/fal-ai/sadtalker`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      source_image_url: faceImageUrl,
      driven_audio_url: audioUrl,
      still_mode: true,       // Mantém cabeça mais estável (foto -> vídeo)
      preprocess: 'crop',     // Crop no rosto para melhor qualidade
      enhancer: 'gfpgan',     // Melhorar qualidade facial
    }),
  })

  const data = await safeJson(res)

  if (!res.ok) {
    console.error('[LipSync] SadTalker error:', data)
    throw new Error(`SadTalker error ${res.status}: ${JSON.stringify(data)}`)
  }

  // Queue mode — polling
  if (data.request_id) {
    return await pollForVideo(data)
  }

  // Sync mode
  if (data.video?.url) return data.video.url
  if (data.video_url) return data.video_url

  throw new Error('SadTalker não retornou vídeo')
}

async function pollForVideo(data: { request_id: string; status_url: string; response_url: string }): Promise<string> {
  const maxAttempts = 90 // SadTalker pode demorar um pouco
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(data.status_url, {
      headers: { 'Authorization': `Key ${getApiKey()}` },
    })
    const statusData = await safeJson(statusRes)

    console.log(`[LipSync] Status (${i + 1}/${maxAttempts}):`, statusData.status)

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(data.response_url, {
        headers: { 'Authorization': `Key ${getApiKey()}` },
      })
      const resultData = await safeJson(resultRes)
      const videoUrl = resultData.video?.url || resultData.video_url
      if (videoUrl) {
        console.log('[LipSync] Vídeo gerado com sucesso!')
        return videoUrl
      }
      throw new Error('SadTalker completou mas sem video_url')
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`SadTalker falhou: ${JSON.stringify(statusData)}`)
    }

    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error('Timeout: SadTalker não completou')
}

/**
 * Pipeline completo: foto da Mônica local → lip-sync video
 *
 * 1. Upload da foto da Mônica para Fal.ai
 * 2. Gera lip-sync com o áudio fornecido
 * 3. Retorna URL do vídeo
 */
export async function generatePresenterVideo(audioBuffer: Buffer): Promise<string> {
  // Upload da foto da Mônica
  const monicaPath = path.join(process.cwd(), 'public', 'monica.png')
  if (!existsSync(monicaPath)) {
    throw new Error('monica.png não encontrado em public/')
  }

  const faceUrl = await uploadImageToFal(monicaPath)
  console.log('[LipSync] Foto da Mônica uploaded:', faceUrl.slice(0, 60))

  // Gerar vídeo lip-sync
  return await generateLipSyncVideo(faceUrl, audioBuffer)
}
