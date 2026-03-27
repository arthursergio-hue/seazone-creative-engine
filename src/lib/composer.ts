import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

const OUTPUT_DIR = join(process.cwd(), 'public', 'output')
const TEMP_DIR = join(process.cwd(), 'tmp')

function getFfmpegPath(): string {
  try {
    return require('ffmpeg-static')
  } catch {
    return 'ffmpeg' // fallback to system ffmpeg
  }
}

export interface ClipInput {
  type: string
  videoUrl: string
  audioUrl?: string
  overlayTitle: string
  overlaySubtitle?: string
}

export interface ComposeOptions {
  clips: ClipInput[]
  backgroundMusicUrl?: string
  outputFilename: string
  format?: '16:9' | '9:16'
}

// Baixa arquivo de URL para disco local
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} for ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(destPath, buffer)
}

// Gera um clipe individual com texto overlay + narração
async function processClip(
  clip: ClipInput,
  index: number,
  ffmpeg: string
): Promise<string> {
  const videoPath = join(TEMP_DIR, `clip_${index}_video.mp4`)
  const outputPath = join(TEMP_DIR, `clip_${index}_processed.mp4`)

  // Baixar vídeo
  await downloadFile(clip.videoUrl, videoPath)

  // Construir filtro de texto overlay
  const title = clip.overlayTitle.replace(/'/g, "'\\''").replace(/:/g, '\\:')
  const subtitle = clip.overlaySubtitle?.replace(/'/g, "'\\''").replace(/:/g, '\\:') || ''

  // Filtro: adicionar fundo semi-transparente + textos
  let filterComplex = [
    // Barra inferior semi-transparente
    `drawbox=y=ih*0.75:w=iw:h=ih*0.25:color=black@0.5:t=fill`,
    // Título principal
    `drawtext=text='${title}':fontsize=42:fontcolor=white:x=(w-text_w)/2:y=h*0.78:fontfile=/Windows/Fonts/arial.ttf:borderw=2:bordercolor=black@0.3`,
  ]

  if (subtitle) {
    filterComplex.push(
      `drawtext=text='${subtitle}':fontsize=24:fontcolor=white@0.9:x=(w-text_w)/2:y=h*0.87:fontfile=/Windows/Fonts/arial.ttf:borderw=1:bordercolor=black@0.3`
    )
  }

  // Se tem narração, mixar áudio
  if (clip.audioUrl) {
    const audioPath = join(TEMP_DIR, `clip_${index}_audio.mp3`)
    // Áudio é caminho local (public/audio/...)
    const audioLocalPath = clip.audioUrl.startsWith('/')
      ? join(process.cwd(), 'public', clip.audioUrl)
      : clip.audioUrl

    const cmd = `"${ffmpeg}" -y -i "${videoPath}" -i "${audioLocalPath}" -vf "${filterComplex.join(',')}" -c:v libx264 -preset fast -c:a aac -shortest -map 0:v:0 -map 1:a:0 "${outputPath}"`
    await execAsync(cmd, { timeout: 60000 })
  } else {
    const cmd = `"${ffmpeg}" -y -i "${videoPath}" -vf "${filterComplex.join(',')}" -c:v libx264 -preset fast -c:a copy "${outputPath}"`
    await execAsync(cmd, { timeout: 60000 })
  }

  return outputPath
}

// Compõe vídeo final concatenando os clipes processados
export async function composeVideo(options: ComposeOptions): Promise<string> {
  const ffmpeg = getFfmpegPath()

  // Criar diretórios
  for (const dir of [OUTPUT_DIR, TEMP_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }

  const processedClips: string[] = []

  // Processar cada clipe (com overlay + narração)
  for (let i = 0; i < options.clips.length; i++) {
    const clipPath = await processClip(options.clips[i], i, ffmpeg)
    processedClips.push(clipPath)
  }

  // Criar arquivo de lista para concat
  const concatListPath = join(TEMP_DIR, 'concat_list.txt')
  const concatContent = processedClips.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n')
  await writeFile(concatListPath, concatContent)

  // Concatenar todos os clipes
  const finalOutput = join(OUTPUT_DIR, `${options.outputFilename}.mp4`)
  const concatCmd = `"${ffmpeg}" -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset fast -c:a aac "${finalOutput}"`
  await execAsync(concatCmd, { timeout: 120000 })

  // Se tem música de fundo, mixar
  if (options.backgroundMusicUrl) {
    const musicPath = join(TEMP_DIR, 'bg_music.mp3')
    if (options.backgroundMusicUrl.startsWith('http')) {
      await downloadFile(options.backgroundMusicUrl, musicPath)
    }
    // Mixar: narração em volume alto, música em volume baixo
    const withMusicOutput = join(OUTPUT_DIR, `${options.outputFilename}_final.mp4`)
    const mixCmd = `"${ffmpeg}" -y -i "${finalOutput}" -i "${musicPath}" -filter_complex "[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=shortest[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac "${withMusicOutput}"`

    try {
      await execAsync(mixCmd, { timeout: 120000 })
      return `/output/${options.outputFilename}_final.mp4`
    } catch {
      // Se falhar a mixagem de música, retornar sem música
      return `/output/${options.outputFilename}.mp4`
    }
  }

  // Limpar temp files
  for (const p of processedClips) {
    try { await unlink(p) } catch {}
  }

  return `/output/${options.outputFilename}.mp4`
}

// Versão simplificada: adiciona overlay de texto a um único vídeo
export async function addOverlayToVideo(
  videoUrl: string,
  title: string,
  subtitle: string,
  narrationPath: string | null,
  outputName: string
): Promise<string> {
  const ffmpeg = getFfmpegPath()

  for (const dir of [OUTPUT_DIR, TEMP_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  }

  const videoPath = join(TEMP_DIR, `${outputName}_src.mp4`)
  await downloadFile(videoUrl, videoPath)

  const safeTitle = title.replace(/'/g, "'\\''").replace(/:/g, '\\:')
  const safeSub = subtitle.replace(/'/g, "'\\''").replace(/:/g, '\\:')
  const outputPath = join(OUTPUT_DIR, `${outputName}.mp4`)

  const filters = [
    `drawbox=y=ih*0.72:w=iw:h=ih*0.28:color=black@0.45:t=fill`,
    `drawtext=text='${safeTitle}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h*0.76:fontfile=/Windows/Fonts/arial.ttf:borderw=2:bordercolor=black@0.4`,
    `drawtext=text='${safeSub}':fontsize=26:fontcolor=white@0.85:x=(w-text_w)/2:y=h*0.86:fontfile=/Windows/Fonts/arial.ttf:borderw=1:bordercolor=black@0.3`,
  ]

  if (narrationPath) {
    const audioPath = join(process.cwd(), 'public', narrationPath)
    const cmd = `"${ffmpeg}" -y -i "${videoPath}" -i "${audioPath}" -vf "${filters.join(',')}" -c:v libx264 -preset fast -c:a aac -shortest -map 0:v:0 -map 1:a:0 "${outputPath}"`
    await execAsync(cmd, { timeout: 60000 })
  } else {
    const cmd = `"${ffmpeg}" -y -i "${videoPath}" -vf "${filters.join(',')}" -c:v libx264 -preset fast -an "${outputPath}"`
    await execAsync(cmd, { timeout: 60000 })
  }

  try { await unlink(videoPath) } catch {}

  return `/output/${outputName}.mp4`
}
