'use client'

import { useState, useEffect, useCallback } from 'react'

type AssetCategory = 'fachada' | 'interior' | 'localizacao' | 'rooftop'
type VideoType = 'apresentadora_falando' | 'fachada_cinematic' | 'interior_tour' | 'localizacao_aerial' | 'rooftop_lifestyle'

interface UploadedImage {
  url: string
  label: string
  category: AssetCategory
  file?: File
  preview?: string
}

interface VideoCreative {
  id: string
  label: string
  sourceImage: string
  status: string
  videoUrl?: string
  error?: string
}

interface Pipeline {
  id: string
  briefing: string
  status: string
  videos: VideoCreative[]
  startedAt: string
  completedAt?: string
}

const ASSET_CATEGORIES: { value: AssetCategory; label: string; description: string }[] = [
  { value: 'fachada', label: 'Fachada', description: 'Imagem da fachada do empreendimento' },
  { value: 'interior', label: 'Interior', description: 'Foto do apartamento/studio' },
  { value: 'localizacao', label: 'Localização', description: 'Vista aérea ou mapa da região' },
  { value: 'rooftop', label: 'Rooftop/Área comum', description: 'Piscina, terraço, áreas comuns' },
]

const VIDEO_OPTIONS: { value: VideoType; label: string; requires: AssetCategory | 'apresentadora' }[] = [
  { value: 'apresentadora_falando', label: 'Mônica apresentando o empreendimento', requires: 'apresentadora' },
  { value: 'fachada_cinematic', label: 'Fachada — vídeo cinematográfico', requires: 'fachada' },
  { value: 'interior_tour', label: 'Interior — tour pelo apartamento', requires: 'interior' },
  { value: 'localizacao_aerial', label: 'Localização — vista aérea', requires: 'localizacao' },
  { value: 'rooftop_lifestyle', label: 'Rooftop — piscina e lifestyle', requires: 'rooftop' },
]

// Mônica pré-configurada (imagem fixa da apresentadora)
const MONICA_IMAGE = '/uploads/apresentadora/monica.png'

export default function Home() {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [briefing, setBriefing] = useState('')
  const [selectedVideos, setSelectedVideos] = useState<VideoType[]>([
    'apresentadora_falando', 'fachada_cinematic', 'interior_tour',
  ])
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (files: FileList, category: AssetCategory) => {
    setUploading(true)
    setError('')
    try {
      for (const file of Array.from(files)) {
        // Criar preview local imediato
        const preview = URL.createObjectURL(file)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', category)

        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Erro no upload')

        setImages(prev => [...prev, {
          url: data.url,
          label: file.name,
          category,
          preview,
        }])
      }
    } catch (err) {
      console.error('Upload error:', err)
      // Se o upload para o servidor falhar, ainda assim mostrar a imagem localmente
      // para que o usuário saiba que selecionou o arquivo
      for (const file of Array.from(files)) {
        const preview = URL.createObjectURL(file)
        setImages(prev => [...prev, {
          url: preview, // usa URL local como fallback
          label: file.name,
          category,
          preview,
        }])
      }
      setError(`Upload: ${err instanceof Error ? err.message : 'Erro'} — imagem adicionada localmente`)
    }
    setUploading(false)
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const toggleVideo = (type: VideoType) => {
    setSelectedVideos(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const canGenerate = () => {
    return selectedVideos.some(vt => {
      const opt = VIDEO_OPTIONS.find(o => o.value === vt)
      if (!opt) return false
      if (opt.requires === 'apresentadora') return true // Mônica já está configurada
      return images.some(img => img.category === opt.requires)
    })
  }

  const startGeneration = async () => {
    if (!canGenerate()) {
      setError('Faça upload de pelo menos uma imagem para os vídeos selecionados')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Montar assets incluindo a Mônica
      const assets = [
        ...images.map(img => ({ url: img.url, label: img.label, category: img.category })),
        { url: MONICA_IMAGE, label: 'Mônica — Apresentadora Seazone', category: 'apresentadora' as const },
      ]

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingText: briefing || 'Novo Campeche SPOT II — ROI 16,40%, Rendimento R$ 5.500/mês, Localização premium no Campeche, Florianópolis',
          assets,
          videoTypes: selectedVideos,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      pollStatus(data.pipelineId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar geração')
      setLoading(false)
    }
  }

  const pollStatus = useCallback(async (pipelineId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/status?id=${pipelineId}`)
        const data: Pipeline = await res.json()
        setPipeline(data)
        return data.status === 'completed' || data.status === 'failed'
      } catch {
        return false
      }
    }

    await poll()
    const interval = setInterval(async () => {
      const done = await poll()
      if (done) {
        clearInterval(interval)
        setLoading(false)
      }
    }, 4000)
  }, [])

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: 'bg-gray-100 text-gray-700',
      generating_audio: 'bg-purple-100 text-purple-800',
      generating_video: 'bg-blue-100 text-blue-800',
      lip_syncing: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-yellow-100 text-yellow-800',
    }
    const labels: Record<string, string> = {
      queued: 'Na fila',
      generating_audio: 'Gerando voz...',
      generating_video: 'Gerando vídeo...',
      lip_syncing: 'Sincronizando lábios...',
      completed: 'Pronto!',
      failed: 'Falhou',
      running: 'Em andamento',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#00143D] text-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo-seazone.png" alt="Seazone" className="h-10 brightness-0 invert" />
              <div className="border-l border-blue-800 pl-4">
                <h1 className="text-lg font-bold tracking-tight">Creative Engine</h1>
                <p className="text-blue-300 text-xs">Gerador de vídeos para campanhas</p>
              </div>
            </div>
            <span className="text-xs bg-[#0055FF] px-3 py-1 rounded-full">9:16 Vertical</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* STEP 1: Briefing */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#0055FF] text-white text-xs font-bold px-2.5 py-1 rounded-full">1</span>
            <h2 className="text-lg font-semibold">Briefing do Empreendimento</h2>
          </div>
          <textarea
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Ex: Novo Campeche SPOT II — ROI 16,40%, rendimento mensal R$ 5.500, localização premium no Campeche, Florianópolis. Público: investidores do Sudeste orientados a ROI..."
            className="w-full rounded-xl border border-gray-200 p-4 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:border-transparent resize-none"
          />
        </section>

        {/* STEP 2: Upload de imagens */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#0055FF] text-white text-xs font-bold px-2.5 py-1 rounded-full">2</span>
            <h2 className="text-lg font-semibold">Imagens do Empreendimento</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Faça upload das imagens reais. A Mônica (apresentadora) já está configurada automaticamente.
          </p>
          {uploading && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm animate-pulse">Fazendo upload...</div>}
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

          {/* Botões de upload por categoria */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {ASSET_CATEGORIES.map(cat => {
              const hasImage = images.some(img => img.category === cat.value)
              return (
                <label
                  key={cat.value}
                  className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-[#0055FF] hover:bg-blue-50 ${hasImage ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files, cat.value)}
                  />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${hasImage ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {hasImage ? '✓' : '+'}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{cat.label}</div>
                    <div className="text-xs text-gray-400">{cat.description}</div>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Lista de imagens enviadas */}
          {images.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Imagens enviadas ({images.length}):</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group border rounded-xl overflow-hidden bg-gray-50">
                    <img
                      src={img.preview || img.url}
                      alt={img.label}
                      className="w-full aspect-[9/16] object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <span className="inline-block bg-[#0055FF] text-white text-[10px] px-2 py-0.5 rounded-full mb-1">
                        {ASSET_CATEGORIES.find(c => c.value === img.category)?.label || img.category}
                      </span>
                      <div className="text-white text-xs truncate">{img.label}</div>
                    </div>
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mônica pré-configurada */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-12 h-12 bg-[#0055FF] rounded-full flex items-center justify-center text-white font-bold text-lg">M</div>
            <div>
              <div className="text-sm font-medium">Mônica — Apresentadora Seazone</div>
              <div className="text-xs text-gray-500">Pré-configurada automaticamente em todos os criativos</div>
            </div>
            <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Ativa</span>
          </div>
        </section>

        {/* STEP 3: Tipos de vídeo */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-[#0055FF] text-white text-xs font-bold px-2.5 py-1 rounded-full">3</span>
            <h2 className="text-lg font-semibold">Vídeos para Gerar</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Todos os vídeos são gerados em formato 9:16 (vertical) para reels e stories.</p>

          <div className="space-y-2">
            {VIDEO_OPTIONS.map(opt => {
              const hasAsset = opt.requires === 'apresentadora' || images.some(img => img.category === opt.requires)
              const isSelected = selectedVideos.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleVideo(opt.value)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'border-[#0055FF] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    isSelected ? 'bg-[#0055FF] border-[#0055FF]' : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.label}</div>
                    {isSelected && !hasAsset && opt.requires !== 'apresentadora' && (
                      <div className="text-xs text-orange-500 mt-0.5">Faz upload da imagem de {opt.requires} no passo 2</div>
                    )}
                  </div>
                  {opt.requires === 'apresentadora' && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Mônica</span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Botão gerar */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
        )}
        <button
          onClick={startGeneration}
          disabled={loading || uploading || !canGenerate()}
          className="w-full bg-[#0055FF] hover:bg-[#0048D7] disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg shadow-lg shadow-blue-200"
        >
          {uploading ? 'Fazendo upload...' : loading ? 'Gerando vídeos...' : 'Gerar Vídeos com IA'}
        </button>

        {/* Resultado */}
        {pipeline && (
          <section className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Resultado</h2>
              {statusBadge(pipeline.status)}
            </div>
            <p className="text-xs text-gray-400 mb-6">
              Briefing: {pipeline.briefing} | Iniciado: {new Date(pipeline.startedAt).toLocaleString('pt-BR')}
            </p>

            <div className="space-y-4">
              {pipeline.videos.map((video, i) => (
                <div key={i} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">{video.label}</h3>
                    {statusBadge(video.status)}
                  </div>

                  {video.status === 'generating_video' && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                      Gerando vídeo... isso pode levar alguns minutos
                    </div>
                  )}

                  {video.error && (
                    <p className="text-xs text-red-500">{video.error}</p>
                  )}

                  {video.videoUrl && (
                    <div className="mt-3">
                      <video
                        src={video.videoUrl}
                        controls
                        className="w-full max-w-[280px] aspect-[9/16] rounded-lg bg-black"
                      />
                      <a
                        href={video.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs bg-[#0055FF] text-white hover:bg-[#0048D7] px-4 py-2 rounded-lg transition-colors"
                      >
                        Baixar vídeo
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-gray-400">
        Seazone Creative Engine — Powered by Claude Code + Freepik AI (Kling O1)
      </footer>
    </div>
  )
}
