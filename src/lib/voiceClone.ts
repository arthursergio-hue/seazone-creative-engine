// ============================================================
// VOICE CLONING — Clonagem da voz da Mônica via Fal.ai
// ============================================================
// Usa F5-TTS (Fal.ai) para gerar narração com a voz da Mônica
// a partir de áudio de referência extraído dos vídeos .MOV
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

// Cache do áudio de referência da Mônica (upload único)
let _referenceAudioUrl: string | null = null

// Pasta de referência com os .MOV da Mônica
const REFERENCE_FOLDER = path.resolve(
  'G:/Meu Drive/02 - Projetos/Seazone/Projetos IA/Desafio - Ambrosi/materiais/briefing/Photos-3-001'
)

// Áudio de referência pré-extraído (fallback para Vercel)
const PREEXTRACTED_AUDIO = path.resolve(
  process.cwd(), 'public', 'audio', 'monica-ref.wav'
)

/**
 * Upload de arquivo de vídeo/áudio para Fal.ai storage
 * Retorna URL pública do arquivo
 */
async function uploadFileToFal(filePath: string, mimeType: string): Promise<string> {
  const buffer = readFileSync(filePath)

  const res = await fetch('https://fal.run/fal-ai/any-llm/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${getApiKey()}`,
      'Content-Type': mimeType,
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    throw new Error(`Upload para Fal.ai falhou: ${res.status}`)
  }

  const data = await safeJson(res)
  return data.url
}

/**
 * Upload de buffer para Fal.ai storage
 */
async function uploadBufferToFal(buffer: Buffer, mimeType: string): Promise<string> {
  const res = await fetch('https://fal.run/fal-ai/any-llm/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${getApiKey()}`,
      'Content-Type': mimeType,
    },
    body: new Uint8Array(buffer),
  })

  if (!res.ok) {
    throw new Error(`Upload para Fal.ai falhou: ${res.status}`)
  }

  const data = await safeJson(res)
  return data.url
}

/**
 * Obtém URL do áudio de referência da Mônica.
 * Prioridade:
 * 1. Áudio pré-extraído (public/audio/monica-ref.wav)
 * 2. Primeiro .MOV da pasta de referência (upload direto)
 * 3. Cache do upload anterior
 */
export async function getMonicaReferenceAudioUrl(): Promise<string> {
  if (_referenceAudioUrl) return _referenceAudioUrl

  // 1. Tentar áudio pré-extraído
  if (existsSync(PREEXTRACTED_AUDIO)) {
    console.log('[VoiceClone] Usando áudio pré-extraído:', PREEXTRACTED_AUDIO)
    _referenceAudioUrl = await uploadFileToFal(PREEXTRACTED_AUDIO, 'audio/wav')
    return _referenceAudioUrl
  }

  // 2. Tentar primeiro .MOV da pasta de referência
  const movFile = path.join(REFERENCE_FOLDER, 'IMG_4144.MOV')
  if (existsSync(movFile)) {
    console.log('[VoiceClone] Uploading MOV como referência de voz:', movFile)
    // Upload do .MOV completo — o modelo extrai o áudio automaticamente
    _referenceAudioUrl = await uploadFileToFal(movFile, 'video/quicktime')
    return _referenceAudioUrl
  }

  throw new Error('Nenhum arquivo de referência de voz da Mônica encontrado')
}

/**
 * Gera narração com voz clonada da Mônica usando F5-TTS via Fal.ai
 *
 * @param text - Texto para sintetizar
 * @param referenceAudioUrl - URL do áudio de referência (Fal.ai storage)
 * @returns Buffer com áudio WAV da narração
 */
export async function generateClonedNarration(text: string): Promise<Buffer> {
  const refAudioUrl = await getMonicaReferenceAudioUrl()

  console.log('[VoiceClone] Gerando narração com voz clonada da Mônica...')
  console.log('[VoiceClone] Texto:', text.slice(0, 80) + '...')

  // Enviar para F5-TTS via Fal.ai (suporta voice cloning com referência)
  const res = await fetch(`${QUEUE_BASE}/fal-ai/f5-tts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      gen_text: text,
      ref_audio_url: refAudioUrl,
      ref_text: '', // deixar vazio para auto-detect
      model_type: 'F5-TTS',
    }),
  })

  const data = await safeJson(res)

  if (!res.ok) {
    console.error('[VoiceClone] F5-TTS error:', data)
    throw new Error(`F5-TTS error ${res.status}: ${JSON.stringify(data)}`)
  }

  // F5-TTS na queue retorna request_id para polling
  if (data.request_id) {
    const audioUrl = await pollForResult(data)
    return await downloadAudioBuffer(audioUrl)
  }

  // Resposta direta (sync mode)
  if (data.audio_url) {
    return await downloadAudioBuffer(data.audio_url.url || data.audio_url)
  }

  throw new Error('F5-TTS não retornou áudio')
}

async function pollForResult(data: { request_id: string; status_url: string; response_url: string }): Promise<string> {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(data.status_url, {
      headers: { 'Authorization': `Key ${getApiKey()}` },
    })
    const statusData = await safeJson(statusRes)

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(data.response_url, {
        headers: { 'Authorization': `Key ${getApiKey()}` },
      })
      const resultData = await safeJson(resultRes)
      // F5-TTS retorna audio_url
      const audioUrl = resultData.audio_url?.url || resultData.audio_url || resultData.audio?.url
      if (audioUrl) return audioUrl
      throw new Error('F5-TTS completou mas sem audio_url')
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`F5-TTS falhou: ${JSON.stringify(statusData)}`)
    }

    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Timeout: F5-TTS não completou')
}

async function downloadAudioBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download áudio falhou: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Gera narração com voz clonada e retorna como base64 data URL
 */
export async function generateClonedNarrationBase64(text: string): Promise<string> {
  const buffer = await generateClonedNarration(text)
  const base64 = buffer.toString('base64')
  return `data:audio/wav;base64,${base64}`
}
