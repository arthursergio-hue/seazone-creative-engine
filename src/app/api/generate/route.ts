import { NextRequest, NextResponse } from 'next/server'
import { generateVideo } from '@/lib/freepik'
import { generateSpeech, generateScript } from '@/lib/tts'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { briefingText, assets, videoTypes } = body

    const protocol = req.headers.get('x-forwarded-proto') || 'https'
    const host = req.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const VIDEO_TYPE_CONFIG: Record<string, { label: string; category: string; prompt: string }> = {
      apresentadora_falando: {
        label: 'Mônica — apresentando o empreendimento',
        category: 'apresentadora',
        prompt: 'Woman speaking directly to camera with confident warm smile, subtle natural head movements and gestures, professional real estate presentation style, smooth gentle movement, bright clean background',
      },
      fachada_cinematic: {
        label: 'Fachada — vídeo cinematográfico',
        category: 'fachada',
        prompt: 'Slow cinematic upward camera tilt revealing modern apartment building facade, tropical plants swaying gently in breeze, warm golden hour lighting, professional real estate showcase',
      },
      interior_tour: {
        label: 'Interior — tour pelo apartamento',
        category: 'interior',
        prompt: 'Slow smooth camera pan across modern apartment interior, warm ambient lighting, gentle parallax movement revealing furniture details, premium real estate video tour',
      },
      localizacao_aerial: {
        label: 'Localização — vista aérea',
        category: 'localizacao',
        prompt: 'Smooth aerial drone fly-over of coastal neighborhood, gentle descending camera revealing proximity to beach, golden hour lighting, cinematic',
      },
      rooftop_lifestyle: {
        label: 'Rooftop — piscina e lifestyle',
        category: 'rooftop',
        prompt: 'Slow panoramic camera sweep across rooftop pool area, water gently rippling, revealing ocean view, aspirational luxury lifestyle, warm golden lighting',
      },
    }

    const results = []

    for (const videoType of videoTypes) {
      const config = VIDEO_TYPE_CONFIG[videoType]
      if (!config) continue

      const asset = assets.find((a: { category: string }) => a.category === config.category)
      if (!asset) continue

      // Converter URL local para pública
      const imageUrl = asset.url.startsWith('http')
        ? asset.url
        : `${baseUrl}${asset.url}`

      try {
        // Gerar áudio para apresentadora
        let audioUrl: string | undefined
        if (videoType === 'apresentadora_falando') {
          const script = generateScript({
            nome: briefingText || 'Novo Campeche SPOT II',
            roi: '16,40%',
            rendimento: 'R$ 5.500',
            localizacao: 'Campeche, Florianópolis',
            valorizacao: '81%',
          })
          audioUrl = await generateSpeech(script, `audio_${Date.now()}`)
          audioUrl = `${baseUrl}${audioUrl}`
        }

        // Iniciar geração de vídeo na Freepik
        const { taskId } = await generateVideo(imageUrl, config.prompt, {
          duration: videoType === 'apresentadora_falando' ? 10 : 5,
          aspectRatio: '9:16',
        })

        results.push({
          videoType,
          label: config.label,
          taskId,
          audioUrl,
          needsLipSync: videoType === 'apresentadora_falando',
          status: 'generating_video',
        })
      } catch (err) {
        results.push({
          videoType,
          label: config.label,
          taskId: null,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Erro',
        })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
