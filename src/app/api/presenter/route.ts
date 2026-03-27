import { NextResponse } from 'next/server'
import { getPresenterProfile, reloadPresenterProfile, getPresenterTraceInfo } from '@/lib/presenterProfile'
import { getNarrationMetadata } from '@/lib/tts'

/**
 * GET /api/presenter
 * Retorna o perfil completo da apresentadora Mônica,
 * incluindo referências visuais, de voz, e metadados de rastreabilidade.
 *
 * Query params:
 *   ?reload=true  — força re-scan da pasta de referência
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const shouldReload = url.searchParams.get('reload') === 'true'

  const profile = shouldReload ? reloadPresenterProfile() : getPresenterProfile()
  const trace = getPresenterTraceInfo()
  const narrationMeta = getNarrationMetadata()

  return NextResponse.json({
    profile: {
      id: profile.id,
      name: profile.name,
      sourceFolder: profile.sourceFolder,
      lastIngestion: profile.lastIngestion,
      totalFiles: profile.totalFiles,
      visualSupported: profile.visualSupported,
      voiceSupported: profile.voiceSupported,
      staticImagePath: profile.staticImagePath,
      imageReferences: profile.imageReferences.map(r => ({
        filename: r.filename,
        extension: r.extension,
        sizeMB: (r.sizeBytes / 1024 / 1024).toFixed(1),
      })),
      videoReferences: profile.videoReferences.map(r => ({
        filename: r.filename,
        extension: r.extension,
        sizeMB: (r.sizeBytes / 1024 / 1024).toFixed(1),
      })),
      preferredFaceFile: profile.preferredFaceReference?.filename || null,
      preferredVoiceFile: profile.preferredVoiceReference?.filename || null,
      voice: {
        cloningSupported: profile.voice.cloningSupported,
        currentSource: profile.voice.currentSource,
        totalReferenceFiles: profile.voice.referenceAudioFiles.length,
        notes: profile.voice.notes,
      },
      notes: profile.notes,
    },
    trace,
    narration: narrationMeta,
  })
}
