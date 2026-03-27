// Voice Service — abstração para TTS com suporte a ElevenLabs e fallback

import { generateNarrationBase64 } from './tts'

interface VoiceResult {
  audioBase64: string
  provider: string
  isMonicaVoice: boolean
}

// ElevenLabs config
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '' // ID da voz clonada da Mônica

function isElevenLabsAvailable(): boolean {
  return !!(ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID)
}

async function elevenLabsTTS(text: string): Promise<VoiceResult> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`ElevenLabs error ${res.status}: ${errorText.slice(0, 200)}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const base64 = `data:audio/mp3;base64,${buffer.toString('base64')}`

  return {
    audioBase64: base64,
    provider: 'ElevenLabs (voz clonada Mônica)',
    isMonicaVoice: true,
  }
}

async function googleTTSFallback(text: string): Promise<VoiceResult> {
  const audioBase64 = await generateNarrationBase64(text)
  return {
    audioBase64,
    provider: 'Google TTS (genérico)',
    isMonicaVoice: false,
  }
}

/**
 * Gera voz a partir de texto.
 * Tenta ElevenLabs (voz clonada) primeiro, cai para Google TTS se não disponível.
 */
export async function generateVoice(text: string): Promise<VoiceResult> {
  if (isElevenLabsAvailable()) {
    try {
      return await elevenLabsTTS(text)
    } catch (err) {
      console.warn('[VoiceService] ElevenLabs falhou, usando fallback:', err instanceof Error ? err.message : err)
    }
  }

  return googleTTSFallback(text)
}

/**
 * Retorna informações sobre o provider de voz ativo.
 */
export function getVoiceInfo(): { provider: string; isMonicaVoice: boolean; elevenlabsConfigured: boolean } {
  return {
    provider: isElevenLabsAvailable() ? 'ElevenLabs (voz clonada Mônica)' : 'Google TTS (genérico)',
    isMonicaVoice: isElevenLabsAvailable(),
    elevenlabsConfigured: isElevenLabsAvailable(),
  }
}
