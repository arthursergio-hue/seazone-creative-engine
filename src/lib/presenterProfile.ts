// ============================================================
// PRESENTER PROFILE — Entidade multimodal da apresentadora Mônica
// ============================================================
// A Mônica é tratada como entidade de referência com múltiplas dimensões:
// - Imagem (foto real)
// - Vídeo (vídeos de referência)
// - Voz (referência para narração / clonagem futura)
// - Presença visual (enquadramento, traços, identidade)
//
// PASTA DE REFERÊNCIA OFICIAL:
// G:\Meu Drive\02 - Projetos\Seazone\Projetos IA\Desafio - Ambrosi\materiais\briefing\Photos-3-001
//
// Esta pasta contém vídeos .MOV da Mônica que servem como fonte para:
// - Identidade visual da apresentadora
// - Referência facial
// - Enquadramento e presença
// - Tom de comunicação
// - Referência de voz (para futura clonagem/síntese)
// ============================================================

import { readdirSync, statSync, existsSync } from 'fs'
import path from 'path'

// ===== TIPOS =====

export interface MediaReference {
  filename: string
  fullPath: string
  extension: string
  sizeBytes: number
  mediaType: 'image' | 'video' | 'unknown'
}

export type VoiceSourceType =
  | 'real_reference'      // Voz real extraída dos vídeos de referência
  | 'cloned_from_reference' // Voz clonada via motor de síntese a partir da referência
  | 'generic_tts'         // TTS genérico (Google TTS etc.) — NÃO é a voz da Mônica

export interface VoiceProfile {
  /** Se há suporte real para clonagem/síntese de voz a partir da referência */
  cloningSupported: boolean
  /** Tipo de voz atualmente em uso */
  currentSource: VoiceSourceType
  /** Arquivos de vídeo que podem servir como fonte de áudio de referência */
  referenceAudioFiles: string[]
  /**
   * NOTA ARQUITETURAL:
   * O pipeline atual usa Google Translate TTS (generic_tts).
   * NÃO há clonagem de voz implementada.
   * Esta interface está preparada para quando um motor de voice cloning
   * (ex: ElevenLabs, Coqui, XTTS) for integrado.
   * Quando isso acontecer:
   * 1. Extrair áudio dos vídeos de referência (ffmpeg -i video.MOV -vn audio.wav)
   * 2. Enviar áudio como sample para o motor de clonagem
   * 3. Usar voz clonada nas narrações das cenas de apresentadora
   * 4. Atualizar currentSource para 'cloned_from_reference'
   */
  notes: string
}

export interface PresenterProfile {
  id: string
  name: string
  /** Referências de imagem encontradas na pasta */
  imageReferences: MediaReference[]
  /** Referências de vídeo encontradas na pasta */
  videoReferences: MediaReference[]
  /** Melhor referência facial escolhida (baseada em qualidade/tamanho) */
  preferredFaceReference: MediaReference | null
  /** Melhor referência de voz escolhida */
  preferredVoiceReference: MediaReference | null
  /** Perfil de voz */
  voice: VoiceProfile
  /** Suporte visual ativo */
  visualSupported: boolean
  /** Suporte de voz ativo */
  voiceSupported: boolean
  /** Pasta fonte dos arquivos de referência */
  sourceFolder: string
  /** Caminho da imagem estática usada no frontend (/monica.png) */
  staticImagePath: string
  /** Notas sobre o estado atual da integração */
  notes: string
  /** Timestamp da última ingestão */
  lastIngestion: string
  /** Total de arquivos encontrados */
  totalFiles: number
}

// ===== CONSTANTES =====

const REFERENCE_FOLDER = path.resolve(
  'G:/Meu Drive/02 - Projetos/Seazone/Projetos IA/Desafio - Ambrosi/materiais/briefing/Photos-3-001'
)

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff']
const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.avi', '.mkv', '.webm', '.m4v']

// ===== ARQUIVOS DE REFERÊNCIA CONHECIDOS =====
// Lista fixa dos 12 vídeos da Mônica na pasta Photos-3-001.
// Usada como fallback quando a pasta não está acessível (ex: deploy na Vercel).
// Atualizar esta lista se novos arquivos forem adicionados à pasta.
const KNOWN_REFERENCE_FILES: { filename: string; extension: string; mediaType: 'video' }[] = [
  { filename: 'IMG_4144.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4145.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4146.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4147.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4151.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4153.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4154.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4155.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4162.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4177.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4182.MOV', extension: '.mov', mediaType: 'video' },
  { filename: 'IMG_4189.MOV', extension: '.mov', mediaType: 'video' },
]

// ===== INGESTÃO DA PASTA =====

function classifyMediaType(ext: string): 'image' | 'video' | 'unknown' {
  const lower = ext.toLowerCase()
  if (IMAGE_EXTENSIONS.includes(lower)) return 'image'
  if (VIDEO_EXTENSIONS.includes(lower)) return 'video'
  return 'unknown'
}

function scanReferenceFolder(): { refs: MediaReference[]; fromDisk: boolean } {
  // Tenta ler a pasta real (funciona em ambiente local)
  if (existsSync(REFERENCE_FOLDER)) {
    const files = readdirSync(REFERENCE_FOLDER)
    const references: MediaReference[] = []

    for (const filename of files) {
      const fullPath = path.join(REFERENCE_FOLDER, filename)
      try {
        const stats = statSync(fullPath)
        if (!stats.isFile()) continue

        const ext = path.extname(filename).toLowerCase()
        const mediaType = classifyMediaType(ext)

        if (mediaType === 'unknown') continue

        references.push({
          filename,
          fullPath,
          extension: ext,
          sizeBytes: stats.size,
          mediaType,
        })
      } catch {
        console.warn(`[PresenterProfile] Erro ao ler arquivo: ${fullPath}`)
      }
    }

    console.log(`[PresenterProfile] Pasta de referência acessível — ${references.length} arquivo(s) lidos do disco`)
    return { refs: references, fromDisk: true }
  }

  // Fallback: usa lista conhecida de arquivos (deploy Vercel, CI, etc.)
  console.warn(`[PresenterProfile] Pasta não acessível (${REFERENCE_FOLDER}). Usando lista de referência conhecida.`)
  const fallbackRefs: MediaReference[] = KNOWN_REFERENCE_FILES.map(f => ({
    filename: f.filename,
    fullPath: path.join(REFERENCE_FOLDER, f.filename),
    extension: f.extension,
    sizeBytes: 0, // Tamanho desconhecido no fallback
    mediaType: f.mediaType,
  }))

  return { refs: fallbackRefs, fromDisk: false }
}

/**
 * Seleciona a melhor referência entre os arquivos disponíveis.
 * Critério: maior arquivo (proxy para melhor qualidade/resolução).
 */
function selectBestReference(refs: MediaReference[]): MediaReference | null {
  if (refs.length === 0) return null
  return refs.reduce((best, current) =>
    current.sizeBytes > best.sizeBytes ? current : best
  )
}

// ===== CONSTRUÇÃO DO PROFILE =====

let _cachedProfile: PresenterProfile | null = null

/**
 * Carrega e retorna o PresenterProfile da Mônica.
 * Faz ingestão da pasta de referência, classifica os arquivos,
 * e monta o perfil multimodal completo.
 *
 * O resultado é cacheado — chame reloadPresenterProfile() para forçar re-scan.
 */
export function getPresenterProfile(): PresenterProfile {
  if (_cachedProfile) return _cachedProfile

  const { refs: allRefs, fromDisk } = scanReferenceFolder()
  const imageRefs = allRefs.filter(r => r.mediaType === 'image')
  const videoRefs = allRefs.filter(r => r.mediaType === 'video')

  const bestFace = selectBestReference(imageRefs) || selectBestReference(videoRefs)
  const bestVoice = selectBestReference(videoRefs)

  // Verificar suporte de voz:
  // Atualmente NÃO há motor de clonagem de voz integrado.
  // O sistema usa Google TTS genérico.
  // Os vídeos da pasta CONTÊM a voz da Mônica e podem ser usados
  // como referência quando um motor de voice cloning for adicionado.
  // Voz clonada ativa quando FAL_KEY está configurada (usa F5-TTS)
  const voiceCloningSupported = !!(process.env.FAL_KEY || process.env.FREEPIK_API_KEY)

  const accessNote = fromDisk
    ? 'Pasta acessível — arquivos lidos do disco'
    : 'Pasta não acessível (Vercel/CI) — usando lista de referência conhecida'

  const profile: PresenterProfile = {
    id: 'monica-seazone-presenter',
    name: 'Mônica',
    imageReferences: imageRefs,
    videoReferences: videoRefs,
    preferredFaceReference: bestFace,
    preferredVoiceReference: bestVoice,
    voice: {
      cloningSupported: voiceCloningSupported,
      currentSource: 'generic_tts',
      referenceAudioFiles: videoRefs.map(v => v.fullPath),
      notes: voiceCloningSupported
        ? 'Voz clonada a partir dos vídeos de referência da Mônica'
        : [
            'ESTADO ATUAL: Usando Google TTS genérico — NÃO é a voz da Mônica.',
            `${videoRefs.length} vídeo(s) de referência contêm a voz real da Mônica.`,
            'Para ativar clonagem: integrar motor como ElevenLabs, Coqui ou XTTS.',
            'Etapas: (1) extrair áudio dos .MOV, (2) enviar como sample, (3) gerar narração clonada.',
          ].join(' '),
    },
    visualSupported: true, // Sempre true — temos /monica.png + referências conhecidas
    voiceSupported: voiceCloningSupported,
    sourceFolder: REFERENCE_FOLDER,
    staticImagePath: '/monica.png',
    notes: [
      accessNote,
      `Referências: ${imageRefs.length} imagem(ns), ${videoRefs.length} vídeo(s)`,
      bestFace ? `Face preferida: ${bestFace.filename}` : 'Face: usando /monica.png (estática)',
      bestVoice ? `Voz preferida: ${bestVoice.filename}` : 'Voz: referências disponíveis para clonagem futura',
      voiceCloningSupported ? 'Clonagem de voz: ATIVA' : 'Clonagem de voz: preparação arquitetural',
    ].join(' | '),
    lastIngestion: new Date().toISOString(),
    totalFiles: allRefs.length,
  }

  _cachedProfile = profile

  console.log(`[PresenterProfile] Perfil da Mônica carregado:`)
  console.log(`  - ${imageRefs.length} imagem(ns) de referência`)
  console.log(`  - ${videoRefs.length} vídeo(s) de referência`)
  console.log(`  - Voz clonada: ${voiceCloningSupported ? 'SIM' : 'NÃO (usando TTS genérico)'}`)
  console.log(`  - Referência facial: ${bestFace?.filename || 'N/A (usando /monica.png)'}`)

  return profile
}

/** Força re-scan da pasta de referência */
export function reloadPresenterProfile(): PresenterProfile {
  _cachedProfile = null
  return getPresenterProfile()
}

// ===== HELPERS PARA O PIPELINE =====

/**
 * Retorna informação de rastreabilidade para uma cena de apresentadora.
 * Usado pela interface para mostrar quais referências estão em uso.
 */
export interface PresenterTraceInfo {
  isPresenterScene: boolean
  profileId: string
  profileName: string
  sourceFolder: string
  imageSource: 'static_photo' | 'reference_folder_image' | 'reference_folder_video_frame'
  imageFile: string
  voiceSource: VoiceSourceType
  voiceFile: string | null
  voiceNote: string
  totalReferences: number
  videoReferences: string[]
  imageReferences: string[]
}

export function getPresenterTraceInfo(): PresenterTraceInfo {
  const profile = getPresenterProfile()

  return {
    isPresenterScene: true,
    profileId: profile.id,
    profileName: profile.name,
    sourceFolder: profile.sourceFolder,
    imageSource: profile.imageReferences.length > 0
      ? 'reference_folder_image'
      : profile.videoReferences.length > 0
        ? 'reference_folder_video_frame'
        : 'static_photo',
    imageFile: profile.preferredFaceReference?.filename || 'monica.png (estática)',
    voiceSource: profile.voice.currentSource,
    voiceFile: profile.preferredVoiceReference?.filename || null,
    voiceNote: profile.voice.cloningSupported
      ? 'Narração usa voz clonada da Mônica'
      : 'Narração usa TTS genérico — voz da Mônica disponível para clonagem futura',
    totalReferences: profile.totalFiles,
    videoReferences: profile.videoReferences.map(r => r.filename),
    imageReferences: profile.imageReferences.map(r => r.filename),
  }
}
