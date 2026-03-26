import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// StreamElements TTS (gratuito, sem API key, funciona em serverless)
export async function generateSpeech(text: string, filename: string): Promise<string> {
  const outputDir = join('/tmp', 'audio')
  await mkdir(outputDir, { recursive: true })

  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outputPath = join(outputDir, `${safeName}.mp3`)

  const params = new URLSearchParams({
    voice: 'Camila',
    text: text.slice(0, 500),
  })

  const res = await fetch(`https://api.streamelements.com/kappa/v2/speech?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })

  if (!res.ok) {
    throw new Error(`TTS error ${res.status}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(outputPath, buffer)

  return `/api/audio?file=${safeName}.mp3`
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
