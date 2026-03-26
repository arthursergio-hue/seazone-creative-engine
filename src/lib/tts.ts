import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import WebSocket from 'ws'

// Microsoft Edge TTS via WebSocket (gratuito, sem API key)
const VOICE = 'pt-BR-FranciscaNeural'
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'

export async function generateSpeech(text: string, filename: string): Promise<string> {
  // Usar /tmp/ para compatibilidade com Vercel (serverless)
  const outputDir = join('/tmp', 'audio')
  await mkdir(outputDir, { recursive: true })

  const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outputPath = join(outputDir, `${safeName}.mp3`)

  const audioBuffer = await synthesize(text)
  await writeFile(outputPath, audioBuffer)

  // Retorna path para servir via API route
  return `/api/audio?file=${safeName}.mp3`
}


async function synthesize(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID().replace(/-/g, '')
    const timestamp = new Date().toISOString()
    const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${requestId}`

    const ws = new (typeof WebSocket !== 'undefined' ? WebSocket : require('ws'))(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      },
    })

    const audioChunks: Buffer[] = []
    let audioStarted = false

    ws.on('open', () => {
      // Config message
      ws.send(`Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`)

      // SSML message
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='${VOICE}'><prosody rate='-5%' pitch='+0Hz'>${escapeXml(text)}</prosody></voice></speak>`

      ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`)
    })

    ws.on('message', (data: Buffer | string) => {
      if (typeof data === 'string' || data instanceof String) {
        const str = data.toString()
        if (str.includes('Path:turn.end')) {
          ws.close()
          resolve(Buffer.concat(audioChunks))
        }
      } else {
        const buf = Buffer.from(data as unknown as ArrayBuffer)
        const headerEnd = buf.indexOf('Path:audio\r\n')
        if (headerEnd !== -1) {
          const audioData = buf.slice(headerEnd + 'Path:audio\r\n'.length)
          if (audioData.length > 0) {
            audioChunks.push(audioData)
          }
        }
      }
    })

    ws.on('error', (err: Error) => reject(err))

    setTimeout(() => {
      ws.close()
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks))
      } else {
        reject(new Error('TTS timeout'))
      }
    }, 30000)
  })
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
