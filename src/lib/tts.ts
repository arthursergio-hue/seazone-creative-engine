import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { VoiceSourceType } from './presenterProfile'

const IS_VERCEL = process.env.VERCEL === '1'
const OUTPUT_DIR = IS_VERCEL ? '/tmp/audio' : join(process.cwd(), 'public', 'audio')

// ===== VOICE PROVIDER INTERFACE =====
// Preparação arquitetural para múltiplos provedores de voz.
// Atualmente só o Google TTS genérico está implementado.
// Quando um motor de clonagem (ElevenLabs, Coqui, XTTS) for integrado,
// basta implementar esta interface e registrar como provider.

export interface VoiceProvider {
  name: string
  sourceType: VoiceSourceType
  /** Gera áudio a partir de texto. Retorna Buffer com áudio MP3/WAV. */
  synthesize(text: string): Promise<Buffer>
  /** Se este provider precisa de sample de referência (para clonagem) */
  requiresReferenceSample: boolean
}

// Provider atual: Google TTS genérico
// NOTA: Este NÃO usa a voz da Mônica. É TTS genérico.
const googleTTSProvider: VoiceProvider = {
  name: 'Google Translate TTS',
  sourceType: 'generic_tts',
  requiresReferenceSample: false,
  synthesize: (text: string) => googleTTS(text),
}

// TODO: Implementar quando motor de clonagem estiver disponível
// const clonedVoiceProvider: VoiceProvider = {
//   name: 'ElevenLabs Cloned Voice',
//   sourceType: 'cloned_from_reference',
//   requiresReferenceSample: true,
//   synthesize: async (text: string) => {
//     // 1. Carregar referência de áudio do PresenterProfile
//     // 2. Enviar para API de clonagem
//     // 3. Retornar áudio sintetizado
//   },
// }

// Provider de voz clonada via F5-TTS (Fal.ai)
let _clonedVoiceProvider: VoiceProvider | null = null

function getClonedVoiceProvider(): VoiceProvider {
  if (!_clonedVoiceProvider) {
    _clonedVoiceProvider = {
      name: 'F5-TTS Voice Clone (Mônica)',
      sourceType: 'cloned_from_reference',
      requiresReferenceSample: true,
      synthesize: async (text: string) => {
        const { generateClonedNarration } = await import('./voiceClone')
        return generateClonedNarration(text)
      },
    }
  }
  return _clonedVoiceProvider
}

/** Retorna o provider de voz ativo para narração */
export function getActiveVoiceProvider(): VoiceProvider {
  // Usar voz clonada se FAL_KEY está configurada
  if (process.env.FAL_KEY || process.env.FREEPIK_API_KEY) {
    return getClonedVoiceProvider()
  }
  // Fallback: Google TTS genérico
  return googleTTSProvider
}

/** Retorna metadados sobre a narração gerada (para rastreabilidade na UI) */
export function getNarrationMetadata(): { provider: string; sourceType: VoiceSourceType; isMonicaVoice: boolean } {
  const provider = getActiveVoiceProvider()
  return {
    provider: provider.name,
    sourceType: provider.sourceType,
    isMonicaVoice: provider.sourceType === 'cloned_from_reference' || provider.sourceType === 'real_reference',
  }
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const sentences = text.split(/(?<=[.!?,;:])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

async function googleTTS(text: string, lang = 'pt-BR'): Promise<Buffer> {
  const chunks = splitText(text, 180)
  const buffers: Buffer[] = []

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob&ttsspeed=0.9`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    })

    if (!res.ok) {
      throw new Error(`TTS error ${res.status}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    buffers.push(Buffer.from(arrayBuffer))
  }

  return Buffer.concat(buffers)
}

export async function generateNarration(
  text: string,
  filename: string
): Promise<string> {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true })
  }

  const audioBuffer = await googleTTS(text)
  const filePath = join(OUTPUT_DIR, `${filename}.mp3`)
  await writeFile(filePath, audioBuffer)

  if (IS_VERCEL) {
    return filePath
  }
  return `/audio/${filename}.mp3`
}

// Gera narração e retorna como base64 data URL (funciona em qualquer ambiente)
export async function generateNarrationBase64(text: string): Promise<string> {
  const audioBuffer = await googleTTS(text)
  const base64 = audioBuffer.toString('base64')
  return `data:audio/mp3;base64,${base64}`
}

export async function generateAllNarrations(
  scripts: Record<string, string>
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}

  for (const [key, text] of Object.entries(scripts)) {
    try {
      results[key] = await generateNarrationBase64(text)
    } catch (err) {
      console.error(`TTS failed for ${key}:`, err)
      results[key] = ''
    }
  }

  return results
}
