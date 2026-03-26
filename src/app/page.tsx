'use client'

import { useState, useEffect, useCallback } from 'react'

type CreativeType = 'fachada' | 'localizacao' | 'roi' | 'rendimento' | 'lifestyle' | 'rooftop' | 'apresentadora'

interface Creative {
  type: CreativeType
  label: string
  imageUrl: string
  videoUrl?: string
  status: string
  error?: string
}

interface Pipeline {
  id: string
  briefing: string
  status: string
  creatives: Creative[]
  startedAt: string
  completedAt?: string
}

const CREATIVE_OPTIONS: { value: CreativeType; label: string; description: string }[] = [
  { value: 'fachada', label: 'Fachada', description: 'Fachada do empreendimento' },
  { value: 'localizacao', label: 'Localização', description: 'Vista aérea da região' },
  { value: 'roi', label: 'ROI', description: 'Retorno sobre investimento' },
  { value: 'rendimento', label: 'Rendimento', description: 'Rendimento mensal' },
  { value: 'lifestyle', label: 'Interior', description: 'Studio decorado' },
  { value: 'rooftop', label: 'Rooftop', description: 'Piscina e terraço' },
  { value: 'apresentadora', label: 'Apresentadora', description: 'Porta-voz Seazone' },
]

export default function Home() {
  const [selectedTypes, setSelectedTypes] = useState<CreativeType[]>([
    'fachada', 'localizacao', 'roi', 'rendimento', 'lifestyle', 'rooftop', 'apresentadora',
  ])
  const [customBriefing, setCustomBriefing] = useState('')
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Pipeline[]>([])

  const toggleType = (type: CreativeType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const startGeneration = async () => {
    if (selectedTypes.length === 0) {
      setError('Selecione pelo menos um tipo de criativo')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: selectedTypes,
          briefing: customBriefing || undefined,
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
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?id=${pipelineId}`)
        const data: Pipeline = await res.json()
        setPipeline(data)

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
          setLoading(false)
          loadHistory()
        }
      } catch {
        // Continua polling
      }
    }, 3000)

    // Primeira chamada imediata
    const res = await fetch(`/api/status?id=${pipelineId}`)
    const data: Pipeline = await res.json()
    setPipeline(data)
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setHistory(data)
    } catch {
      // Silencia erro
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      generating_image: 'bg-yellow-100 text-yellow-800',
      generating_video: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      running: 'bg-yellow-100 text-yellow-800',
    }
    const labels: Record<string, string> = {
      generating_image: 'Gerando imagem...',
      generating_video: 'Gerando vídeo...',
      completed: 'Concluído',
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
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0055FF] rounded-lg flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold">Seazone Creative Engine</h1>
              <p className="text-slate-400 text-sm">Gerador autônomo de criativos para campanhas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Painel de Geração */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Novo Criativo</h2>

          {/* Briefing customizado */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Briefing (opcional — padrão: Novo Campeche SPOT II)
            </label>
            <textarea
              value={customBriefing}
              onChange={(e) => setCustomBriefing(e.target.value)}
              placeholder="Descreva o empreendimento, pontos fortes, público-alvo... ou deixe vazio para usar o briefing padrão."
              className="w-full rounded-xl border border-gray-200 p-4 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:border-transparent"
            />
          </div>

          {/* Seleção de tipos */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipos de criativos
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {CREATIVE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleType(opt.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    selectedTypes.includes(opt.value)
                      ? 'border-[#0055FF] bg-blue-50 text-[#0055FF]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Botão gerar */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
          )}
          <button
            onClick={startGeneration}
            disabled={loading}
            className="w-full bg-[#0055FF] hover:bg-[#0048D7] disabled:bg-gray-300 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
          >
            {loading ? 'Gerando criativos...' : 'Gerar Criativos com IA'}
          </button>
        </section>

        {/* Resultado atual */}
        {pipeline && (
          <section className="bg-white rounded-2xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Resultado</h2>
              {statusBadge(pipeline.status)}
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Briefing: {pipeline.briefing} | Iniciado: {new Date(pipeline.startedAt).toLocaleString('pt-BR')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pipeline.creatives.map((creative, i) => (
                <div key={i} className="border rounded-xl overflow-hidden">
                  {/* Imagem */}
                  <div className="aspect-video bg-gray-100 relative">
                    {creative.imageUrl ? (
                      <img
                        src={creative.imageUrl}
                        alt={creative.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-center">
                          <div className="animate-pulse-glow text-3xl mb-2">...</div>
                          <div className="text-sm">Gerando imagem</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{creative.label}</h3>
                      {statusBadge(creative.status)}
                    </div>

                    {creative.error && (
                      <p className="text-xs text-red-500 mt-1">{creative.error}</p>
                    )}

                    {/* Links de download */}
                    <div className="flex gap-2 mt-3">
                      {creative.imageUrl && (
                        <a
                          href={creative.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Baixar imagem
                        </a>
                      )}
                      {creative.videoUrl && (
                        <a
                          href={creative.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-[#0055FF] text-white hover:bg-[#0048D7] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Baixar vídeo
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Briefing de referência */}
        <section className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">Briefing Padrão: Novo Campeche SPOT II</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[#0055FF]">16,40%</div>
              <div className="text-sm text-gray-600 mt-1">ROI estimado</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">R$ 5.500</div>
              <div className="text-sm text-gray-600 mt-1">Rendimento/mês</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">81%</div>
              <div className="text-sm text-gray-600 mt-1">Valorização</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">R$ 350k</div>
              <div className="text-sm text-gray-600 mt-1">Ticket médio</div>
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">Pontos fortes obrigatórios:</h3>
              <ul className="space-y-1 text-gray-600">
                <li>- ROI acima da Selic</li>
                <li>- Localização premium no Campeche</li>
                <li>- Rendimento mensal em reais</li>
                <li>- Fachada valorizada</li>
                <li>- Vista complementar</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-red-600">Não mencionar:</h3>
              <ul className="space-y-1 text-gray-600">
                <li>- Ticket baixo</li>
                <li>- Vista para o mar nas unidades</li>
                <li>- Pé na areia</li>
                <li>- Exclusividade</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-400">
        Seazone Creative Engine — Powered by Claude Code + Freepik AI
      </footer>
    </div>
  )
}
