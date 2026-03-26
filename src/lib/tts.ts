import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// Google Translate TTS (gratuito, sem API key, funciona em serverless)
const TTS_BASE = 'https://translate.google.com/translate_tts'

export async function generateSpeech(text: string, filename: string): Promise<string> {
  const outputDir = join('/tmp', 'audio')
  await mkdir(outputDir, { recursive: true })

  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outputPath = join(outputDir, `${safeName}.mp3`)

  // Dividir texto em chunks de ~200 chars (limite do Google TTS)
  const chunks = splitText(text, 200)
  const audioBuffers: Buffer[] = []

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      ie: 'UTF-8',
      q: chunk,
      tl: 'pt-BR',
      client: 'tw-ob',
    })

    const res = await fetch(`${TTS_BASE}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      throw new Error(`TTS error ${res.status}`)
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    audioBuffers.push(buffer)
  }

  const finalBuffer = Buffer.concat(audioBuffers)
  await writeFile(outputPath, finalBuffer)

  return `/api/audio?file=${safeName}.mp3`
}

function splitText(text: string, maxLen: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}

// Gera roteiro automático baseado no briefing
export function generateScript(briefing: {
  nome: string
  roi?: string
  rendimento?: string
  localizacao?: string
  valorizacao?: string
}): string {
  return `Você sabia que é possível investir em um imóvel em ${briefing.localizacao || 'Florianópolis'} com retorno de ${briefing.roi || '16,40%'} ao ano? O ${briefing.nome} oferece rendimento estimado de ${briefing.rendimento || 'R$ 5.500'} por mês, com valorização de ${briefing.valorizacao || '81%'}. Uma oportunidade real de renda passiva com gestão profissional Seazone. Quer saber mais? Link na bio.`
}
