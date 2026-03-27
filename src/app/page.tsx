'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { SEAZONE_BRAND, LANCAMENTO_IMAGES } from '@/context/seazone'

type CreativeType = 'fachada' | 'localizacao' | 'roi' | 'rendimento' | 'lifestyle' | 'rooftop' | 'apresentadora'
type OutputMode = 'images' | 'videos' | 'both'
type AgentName = 'EstrategistaCriativo' | 'GeradorDeRoteiro' | 'CriadorDeCriativos' | 'GeradorDePecas' | 'GeradorDeNarracao' | 'ValidadorDeCriativos'

interface SceneScript {
  id: string; type: string; title: string; objective: string; narration: string
  screenText: { title: string; subtitle: string }; duration: number; format: string; briefingOrigin: string
}

interface PresenterTraceInfo {
  isPresenterScene: boolean; profileId: string; profileName: string; sourceFolder: string
  imageSource: string; imageFile: string; voiceSource: string; voiceFile: string | null
  voiceNote: string; totalReferences: number; videoReferences: string[]; imageReferences: string[]
}

interface PresenterProfileSummary {
  id: string; name: string; totalImageRefs: number; totalVideoRefs: number
  preferredFaceFile: string | null; preferredVoiceFile: string | null
  voiceSupported: boolean; voiceSource: string; sourceFolder: string
}

interface Creative {
  type: CreativeType; label: string; imageUrl: string; videoUrl?: string; audioUrl?: string
  isLipSync?: boolean; status: string
  error?: string; isReference?: boolean; isFixed?: boolean; isHtml?: boolean
  scene?: SceneScript; subtitle?: string; presenterTrace?: PresenterTraceInfo
}

interface BriefingData {
  nomeEmpreendimento: string; localizacao: string; tipo: string; roi: string
  rendimentoMensal: string; ticketMedio: string; valorizacao: string
  pontosFortes: string[]; diferenciais: string[]; publicoAlvo: string; cta: string
}

interface AgentTraceInfo {
  agent: AgentName; status: string; startedAt: string; completedAt?: string
  error?: string; filesGenerated?: string[]; promptUsed?: string
}

interface LogEntry {
  type: string; timestamp: string; progress: number; agent?: AgentName
  step?: string; log?: { message: string; type: string; agent: string }
  data?: Record<string, unknown>
}

interface Pipeline {
  id: string; briefing: BriefingData
  script: { scenes: SceneScript[]; totalDuration: number; format: string }
  outputMode: string; status: string; creatives: Creative[]
  startedAt: string; completedAt?: string
  presenterProfile?: PresenterProfileSummary
  agentMode?: boolean; progress?: number
  traces?: AgentTraceInfo[]; logs?: LogEntry[]
}

interface ComposeResult {
  type: string; videoUrl: string; narrationAudio: string
  overlay: { title: string; subtitle: string }; narrationText: string; subtitleText: string
}

interface ComposeJob {
  status: 'processing' | 'completed' | 'failed'
  results: ComposeResult[]; sequence: string[]; error?: string
}

// Criativos estáticos (HTML/CSS sobre fotos reais)
interface StaticCreative {
  id: string
  imageUrl: string
  category: string
  template: StaticTemplate
  texts: { headline: string; subline: string; cta?: string; badge?: string }
  variation: number // 0 = padrão, 1+ = variações de cor/layout
}

type StaticTemplate = 'hero' | 'dados' | 'lifestyle' | 'monica_cta' | 'carrossel_info' | 'destaque'

const STATIC_TEMPLATES: { id: StaticTemplate; name: string; description: string }[] = [
  { id: 'hero', name: 'Hero / Capa', description: 'Foto grande + nome + localização' },
  { id: 'dados', name: 'Dados Financeiros', description: 'ROI, rendimento sobre foto' },
  { id: 'lifestyle', name: 'Lifestyle', description: 'Interior/exterior com texto aspiracional' },
  { id: 'monica_cta', name: 'Mônica CTA', description: 'Foto da Mônica com chamada final' },
  { id: 'carrossel_info', name: 'Carrossel Info', description: 'Card informativo clean' },
  { id: 'destaque', name: 'Destaque', description: 'Faixa de cor + dado principal' },
]

const CREATIVE_OPTIONS: { value: CreativeType; label: string; description: string; icon: string; needsRef?: boolean; isFixed?: boolean }[] = [
  { value: 'localizacao', label: 'Localização', description: 'Drone / mapa da região', icon: '📍' },
  { value: 'fachada', label: 'Fachada', description: 'Imagem do prédio', icon: '🏢', needsRef: true },
  { value: 'lifestyle', label: 'Interior', description: 'Studio / apartamento', icon: '🛋️', needsRef: true },
  { value: 'rooftop', label: 'Rooftop', description: 'Área de lazer', icon: '🏊' },
  { value: 'roi', label: 'ROI', description: 'Retorno financeiro', icon: '📈' },
  { value: 'rendimento', label: 'Rendimento', description: 'Renda mensal', icon: '💰' },
  { value: 'apresentadora', label: 'Mônica', description: 'CTA final', icon: '🎬', isFixed: true },
]

const AGENT_LABELS: Record<AgentName, { label: string; icon: string }> = {
  EstrategistaCriativo: { label: 'Estrategista', icon: '🧠' },
  GeradorDeRoteiro: { label: 'Roteirista', icon: '📝' },
  CriadorDeCriativos: { label: 'Criador', icon: '🎨' },
  GeradorDePecas: { label: 'Peças', icon: '📐' },
  GeradorDeNarracao: { label: 'Narração', icon: '🎙️' },
  ValidadorDeCriativos: { label: 'Validador', icon: '✅' },
}

function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const imgEl = new window.Image()
      imgEl.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxWidth / imgEl.width, maxWidth / imgEl.height, 1)
        canvas.width = imgEl.width * ratio
        canvas.height = imgEl.height * ratio
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(reader.result as string); return }
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      imgEl.onerror = () => resolve(reader.result as string)
      imgEl.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Erro ao ler imagem'))
    reader.readAsDataURL(file)
  })
}

async function safeJson(res: Response) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { throw new Error(text.slice(0, 200) || `Erro HTTP ${res.status}`) }
}

const defaultBriefing: BriefingData = {
  nomeEmpreendimento: 'Novo Campeche SPOT II',
  localizacao: 'Campeche, Florianópolis - SC',
  tipo: 'Empreendimento imobiliário de temporada',
  roi: '16,40%',
  rendimentoMensal: 'R$ 5.500',
  ticketMedio: 'R$ 350.190,82',
  valorizacao: '81%',
  pontosFortes: ['ROI acima da Selic', 'Localização premium', 'Gestão profissional Seazone'],
  diferenciais: ['Rooftop com piscina', 'Studios com design contemporâneo'],
  publicoAlvo: 'Investidores 35-55 anos, renda alta',
  cta: 'Fale com um consultor agora',
}

export default function Home() {
  const [briefing, setBriefing] = useState<BriefingData>({ ...defaultBriefing })
  const [freeTextBriefing, setFreeTextBriefing] = useState('')
  const [briefingMode, setBriefingMode] = useState<'structured' | 'freetext' | 'url'>('structured')
  const [briefingUrl, setBriefingUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlMessage, setUrlMessage] = useState('')

  const [selectedTypes, setSelectedTypes] = useState<CreativeType[]>(['localizacao', 'roi', 'rendimento', 'apresentadora'])
  const [aspectRatio, setAspectRatio] = useState<string>('9:16')
  const [outputMode, setOutputMode] = useState<OutputMode>('videos')

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [composeLoading, setComposeLoading] = useState(false)
  const [composeJob, setComposeJob] = useState<ComposeJob | null>(null)
  const [composeError, setComposeError] = useState('')

  const [refImages, setRefImages] = useState<Record<string, string[]>>({})
  const [refPreviews, setRefPreviews] = useState<Record<string, string[]>>({})

  // Estado dos criativos estáticos (HTML/CSS, sem IA)
  const [staticCreatives, setStaticCreatives] = useState<StaticCreative[]>([])
  const [showStaticSection, setShowStaticSection] = useState(false)
  const [previewCreative, setPreviewCreative] = useState<StaticCreative | null>(null)

  // Estado do pipeline de agentes
  const [pipelineProgress, setPipelineProgress] = useState(0)
  const [pipelineLogs, setPipelineLogs] = useState<LogEntry[]>([])
  const [currentAgent, setCurrentAgent] = useState<AgentName | null>(null)
  const [currentStep, setCurrentStep] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Download de um criativo estático
  const downloadCreative = async (creative: StaticCreative) => {
    const el = document.getElementById(`creative-${creative.id}`)
    if (!el) return
    try {
      // Tenta importar html2canvas dinamicamente
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(el, { useCORS: true, scale: 3, backgroundColor: null })
      const link = document.createElement('a')
      link.download = `seazone-${creative.category}-${creative.template}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      // Fallback: abrir em nova aba para screenshot manual
      setError('Use Ctrl+Shift+S (screenshot) ou clique com botão direito > Salvar imagem')
    }
  }

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current && showLogs) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [pipelineLogs, showLogs])

  const updateBriefing = (field: keyof BriefingData, value: string | string[]) => {
    setBriefing(prev => ({ ...prev, [field]: value }))
  }

  const toggleType = (type: CreativeType) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  const handleImageUpload = async (type: string, files: FileList) => {
    try {
      const newImages: string[] = []
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i])
        newImages.push(compressed)
      }
      setRefImages(prev => ({ ...prev, [type]: [...(prev[type] || []), ...newImages] }))
      setRefPreviews(prev => ({ ...prev, [type]: [...(prev[type] || []), ...newImages] }))
      if (!selectedTypes.includes(type as CreativeType)) {
        setSelectedTypes(prev => [...prev, type as CreativeType])
      }
    } catch { setError('Erro ao processar imagem. Tente outra.') }
  }

  // Auto-carregar imagens do lançamento cadastrado
  const loadLancamentoImages = () => {
    const nome = briefing.nomeEmpreendimento
    const images = LANCAMENTO_IMAGES[nome]
    if (!images) {
      setError(`Nenhum banco de imagens encontrado para "${nome}". Faça upload manual.`)
      return
    }
    const newRefImages: Record<string, string[]> = {}
    const categoryMap: Record<string, string> = { fachada: 'fachada', localizacao: 'localizacao', lifestyle: 'lifestyle', rooftop: 'rooftop', drone: 'localizacao', interior: 'lifestyle' }
    for (const img of images) {
      const cat = categoryMap[img.category] || img.category
      if (!newRefImages[cat]) newRefImages[cat] = []
      newRefImages[cat].push(img.path)
    }
    setRefImages(newRefImages)
    setRefPreviews(newRefImages)
    // Auto-selecionar tipos que têm imagens
    const types = Object.keys(newRefImages) as CreativeType[]
    setSelectedTypes(prev => Array.from(new Set([...prev, ...types])))
    setError('')
  }

  const removeImage = (type: string, index: number) => {
    setRefImages(prev => ({ ...prev, [type]: (prev[type] || []).filter((_, i) => i !== index) }))
    setRefPreviews(prev => ({ ...prev, [type]: (prev[type] || []).filter((_, i) => i !== index) }))
  }

  // Gerar criativos estáticos a partir das imagens + briefing
  const generateStaticCreatives = () => {
    // Sempre usar o briefing atual — mesmo em modo freetext, o briefing já foi parseado/mesclado
    const b = briefing
    const creatives: StaticCreative[] = []
    let counter = 0
    const locParts = (b.localizacao || '').split(',')
    const neighborhood = locParts[0]?.trim() || 'Localização'
    const diferenciais = b.diferenciais && b.diferenciais.length > 0 ? b.diferenciais : ['Design premium']
    const pontosFortes = b.pontosFortes && b.pontosFortes.length > 0 ? b.pontosFortes : ['Localização premium']
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

    const allImages = refPreviews

    // Templates variados por categoria para não repetir
    const fachadaTemplates: StaticTemplate[] = ['hero', 'destaque', 'carrossel_info', 'dados']
    const lifestyleTemplates: StaticTemplate[] = ['lifestyle', 'hero', 'destaque']
    const rooftopTemplates: StaticTemplate[] = ['lifestyle', 'dados', 'hero', 'destaque']
    const locTemplates: StaticTemplate[] = ['hero', 'carrossel_info', 'destaque', 'dados']

    // Textos variados para cada categoria
    const fachadaTexts = [
      { headline: b.nomeEmpreendimento, subline: `${neighborhood} — ${b.tipo}`, badge: 'Lançamento' },
      { headline: b.nomeEmpreendimento, subline: `Arquitetura premium em ${neighborhood}`, badge: 'Novo' },
      { headline: `Conheça o ${b.nomeEmpreendimento}`, subline: pontosFortes[0] || b.tipo, badge: 'Destaque' },
      { headline: b.nomeEmpreendimento, subline: diferenciais[0] || b.tipo },
    ]

    const lifestyleTexts = [
      { headline: 'Viva a experiência', subline: diferenciais[0] },
      { headline: 'Design que encanta', subline: 'Experiência premium para seus hóspedes' },
      { headline: 'Alto padrão', subline: diferenciais.find(d => d.toLowerCase().includes('studio') || d.toLowerCase().includes('design')) || 'Ambientes sofisticados' },
      { headline: 'Cada detalhe importa', subline: 'Studios projetados para máxima ocupação' },
    ]

    const rooftopTexts = [
      { headline: 'Área de lazer exclusiva', subline: diferenciais.find(d => d.toLowerCase().includes('rooftop')) || 'Rooftop com piscina' },
      { headline: 'Rooftop premium', subline: 'Piscina com vista para o mar' },
      { headline: 'Experiência no topo', subline: `Diferencial do ${b.nomeEmpreendimento}` },
    ]

    const rooftopDadosTexts = [
      { headline: `ROI de ${b.roi}`, subline: `Rendimento de ${b.rendimentoMensal}/mês`, badge: 'Investimento' },
      { headline: `${b.roi} ao ano`, subline: `Retorno acima do CDI`, badge: 'ROI' },
      { headline: `Renda: ${b.rendimentoMensal}/mês`, subline: `ROI ${b.roi} — Gestão Seazone`, badge: 'Performance' },
    ]

    // Fachada — varia templates e textos
    ;(allImages.fachada || []).forEach((img, i) => {
      creatives.push({
        id: `static-${counter++}`, imageUrl: img, category: 'fachada',
        variation: Math.floor(Math.random() * 4),
        template: fachadaTemplates[i % fachadaTemplates.length],
        texts: fachadaTexts[i % fachadaTexts.length],
      })
    })

    // Interior — varia templates e textos
    ;(allImages.lifestyle || []).forEach((img, i) => {
      creatives.push({
        id: `static-${counter++}`, imageUrl: img, category: 'lifestyle',
        variation: Math.floor(Math.random() * 4),
        template: lifestyleTemplates[i % lifestyleTemplates.length],
        texts: lifestyleTexts[i % lifestyleTexts.length],
      })
    })

    // Rooftop — varia templates e textos
    ;(allImages.rooftop || []).forEach((img, i) => {
      creatives.push({
        id: `static-${counter++}`, imageUrl: img, category: 'rooftop',
        variation: Math.floor(Math.random() * 4),
        template: rooftopTemplates[i % rooftopTemplates.length],
        texts: i === 0 ? pick(rooftopTexts) : pick(rooftopDadosTexts),
      })
    })

    // Localização — varia templates e textos
    const locTexts = [
      { headline: neighborhood, subline: `Valorização de ${b.valorizacao}`, badge: b.localizacao },
      { headline: `${neighborhood} — ${b.valorizacao} de valorização`, subline: `Uma das regiões mais valorizadas de ${locParts[1]?.trim() || 'SC'}`, badge: 'Localização' },
      { headline: `Invista em ${neighborhood}`, subline: pontosFortes[0] || b.localizacao, badge: 'Oportunidade' },
    ]
    ;(allImages.localizacao || []).forEach((img, i) => {
      creatives.push({
        id: `static-${counter++}`, imageUrl: img, category: 'localizacao',
        variation: Math.floor(Math.random() * 4),
        template: locTemplates[i % locTemplates.length],
        texts: i < locTexts.length ? locTexts[i] : { headline: pontosFortes[i % pontosFortes.length], subline: b.localizacao },
      })
    })

    // Dados financeiros (sem foto) — varia textos
    const roiTexts = [
      { headline: `ROI ${b.roi}`, subline: `Ticket médio ${b.ticketMedio}`, badge: 'Retorno' },
      { headline: `${b.roi} ao ano`, subline: `Acima da Selic e do CDI`, badge: 'ROI' },
      { headline: `Retorno: ${b.roi}`, subline: `${b.nomeEmpreendimento} — investimento inteligente`, badge: 'Performance' },
    ]
    creatives.push({
      id: `static-${counter++}`, imageUrl: '', category: 'roi',
      variation: Math.floor(Math.random() * 4),
      template: 'dados',
      texts: pick(roiTexts),
    })

    const rendTexts = [
      { headline: `${b.rendimentoMensal}/mês`, subline: `Valorização de ${b.valorizacao}`, badge: 'Renda passiva' },
      { headline: `Renda: ${b.rendimentoMensal}`, subline: `Todo mês na sua conta`, badge: 'Rendimento' },
      { headline: `${b.rendimentoMensal} mensais`, subline: `Gestão profissional Seazone`, badge: 'Renda real' },
    ]
    creatives.push({
      id: `static-${counter++}`, imageUrl: '', category: 'rendimento',
      variation: Math.floor(Math.random() * 4),
      template: 'dados',
      texts: pick(rendTexts),
    })

    // Mônica CTA — varia textos
    const monicaTexts = [
      { headline: b.cta, subline: `Invista no ${b.nomeEmpreendimento}`, cta: 'Fale com um consultor' },
      { headline: 'Invista com inteligência', subline: `${b.nomeEmpreendimento} — ${neighborhood}`, cta: b.cta },
      { headline: `${b.nomeEmpreendimento}`, subline: 'A Seazone cuida de tudo para você', cta: b.cta },
      { headline: 'Seu próximo investimento', subline: `ROI ${b.roi} — ${b.rendimentoMensal}/mês`, cta: b.cta },
    ]
    creatives.push({
      id: `static-${counter++}`, imageUrl: '/monica.png', category: 'apresentadora',
      variation: Math.floor(Math.random() * 4),
      template: 'monica_cta',
      texts: pick(monicaTexts),
    })

    setStaticCreatives(creatives)
    setShowStaticSection(true)
  }

  // Gerar variação de um criativo: avança o variation (cicla 0→1→2→3→0)
  const generateVariation = (creativeId: string) => {
    setStaticCreatives(prev => prev.map(c =>
      c.id === creativeId ? { ...c, variation: (c.variation + 1) % 4 } : c
    ))
  }

  // Extrair briefing de URL
  const loadBriefingFromUrl = async () => {
    if (!briefingUrl.trim()) return
    setUrlLoading(true)
    setUrlMessage('')
    try {
      const res = await fetch('/api/briefing-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: briefingUrl }),
      })
      const data = await safeJson(res)
      if (data.success && data.briefing) {
        const b = data.briefing
        setBriefing(prev => ({
          ...prev,
          ...(b.nomeEmpreendimento && { nomeEmpreendimento: b.nomeEmpreendimento }),
          ...(b.localizacao && { localizacao: b.localizacao }),
          ...(b.tipo && { tipo: b.tipo }),
          ...(b.roi && { roi: b.roi }),
          ...(b.rendimentoMensal && { rendimentoMensal: b.rendimentoMensal }),
          ...(b.ticketMedio && { ticketMedio: b.ticketMedio }),
          ...(b.valorizacao && { valorizacao: b.valorizacao }),
          ...(b.publicoAlvo && { publicoAlvo: b.publicoAlvo }),
          ...(b.cta && { cta: b.cta }),
          ...(b.pontosFortes?.length && { pontosFortes: b.pontosFortes }),
          ...(b.diferenciais?.length && { diferenciais: b.diferenciais }),
        }))
        const fields = Object.keys(b).length
        setUrlMessage(`${fields} campo(s) extraídos com sucesso!`)
        setBriefingMode('structured')
      } else {
        setUrlMessage(data.error || 'Não foi possível extrair dados da URL')
      }
    } catch (err) {
      setUrlMessage(err instanceof Error ? err.message : 'Erro ao acessar URL')
    }
    setUrlLoading(false)
  }

  // Conectar SSE para progresso em tempo real
  const connectSSE = useCallback((pipelineId: string) => {
    const eventSource = new EventSource(`/api/pipeline/events?id=${pipelineId}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.progress !== undefined) setPipelineProgress(data.progress)
        if (data.currentAgent) setCurrentAgent(data.currentAgent)
        if (data.currentStep) setCurrentStep(data.currentStep)

        if (data.type === 'log' || data.type === 'agent_start' || data.type === 'agent_end' || data.type === 'validation' || data.type === 'error') {
          setPipelineLogs(prev => [...prev.slice(-200), data])
        }

        if (data.type === 'complete' || data.type === 'error') {
          setTimeout(() => eventSource.close(), 2000)
        }
      } catch { /* ignore parse errors */ }
    }

    eventSource.onerror = () => {
      setTimeout(() => eventSource.close(), 5000)
    }

    return eventSource
  }, [])

  const startGeneration = async () => {
    if (selectedTypes.length === 0) {
      setError('Selecione pelo menos um tipo de criativo')
      return
    }

    setLoading(true)
    setError('')
    setComposeJob(null)
    setPipelineProgress(0)
    setPipelineLogs([])
    setCurrentAgent(null)
    setCurrentStep('Iniciando pipeline...')
    setShowLogs(true)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          types: selectedTypes,
          briefing,
          freeTextBriefing: briefingMode === 'freetext' ? freeTextBriefing : undefined,
          aspectRatio,
          outputMode,
          referenceImages: {
            fachada: refImages.fachada?.[0] || undefined,
            lifestyle: refImages.lifestyle?.[0] || undefined,
            rooftop: refImages.rooftop?.[0] || undefined,
            localizacao: refImages.localizacao?.[0] || undefined,
          },
          referenceImagePacks: {
            fachada: refImages.fachada || [],
            lifestyle: refImages.lifestyle || [],
            rooftop: refImages.rooftop || [],
            localizacao: refImages.localizacao || [],
          },
        }),
      })

      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)

      // Conectar SSE para progresso em tempo real
      connectSSE(data.pipelineId)
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
        const data: Pipeline = await safeJson(res)
        setPipeline(data)
        if (data.progress !== undefined) setPipelineProgress(data.progress)
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval)
          setLoading(false)
        }
      } catch { /* retry */ }
    }, 3000)

    const res = await fetch(`/api/status?id=${pipelineId}`)
    const data: Pipeline = await safeJson(res)
    setPipeline(data)
  }, [])

  const startCompose = async () => {
    if (!pipeline) return
    const clipsWithVideo = pipeline.creatives.filter(c => c.videoUrl)
    if (clipsWithVideo.length === 0) { setComposeError('Nenhum vídeo disponível'); return }

    setComposeLoading(true)
    setComposeError('')
    setComposeJob(null)

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'full',
          pipelineId: pipeline.id,
          clips: clipsWithVideo.map(c => ({ type: c.type, videoUrl: c.videoUrl })),
        }),
      })

      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/compose?id=${data.jobId}`)
          const job: ComposeJob = await safeJson(statusRes)
          setComposeJob(job)
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval)
            setComposeLoading(false)
          }
        } catch { /* retry */ }
      }, 3000)
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : 'Erro na composição')
      setComposeLoading(false)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      generating_image: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      generating_video: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      failed: 'bg-red-500/20 text-red-300 border border-red-500/30',
      running: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    }
    const labels: Record<string, string> = {
      generating_image: 'Gerando imagem...',
      generating_video: 'Gerando vídeo...',
      generating_lipsync: 'Lip-sync (Mônica falando)...',
      completed: 'Concluído',
      failed: 'Falhou',
      running: 'Em andamento',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-white/10 border border-white/20'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const renderHtmlCreative = (creative: Creative) => {
    const scene = creative.scene
    if (!scene) return null
    const isRoi = creative.type === 'roi'
    const bg = isRoi
      ? `linear-gradient(135deg, ${SEAZONE_BRAND.colors.secondary} 0%, ${SEAZONE_BRAND.colors.primary} 100%)`
      : `linear-gradient(135deg, ${SEAZONE_BRAND.colors.secondary} 0%, ${SEAZONE_BRAND.colors.deepBlue} 100%)`
    const icon = isRoi ? '📈' : '💰'
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center" style={{ background: bg }}>
        <img src={SEAZONE_BRAND.assets.logo} alt="Seazone" className="w-20 mb-4 brightness-0 invert object-contain" />
        <div className="text-4xl mb-3">{icon}</div>
        <div className="text-3xl font-bold text-white mb-2">{scene.screenText.title}</div>
        <div className="text-sm text-white/70">{scene.screenText.subtitle}</div>
      </div>
    )
  }

  // Ícone casinha para contexto compacto, logo completa para quando cabe
  // compact=false (padrão): logomarca original completa
  // compact=true: só ícone casinha + texto (para quando tem muita info no topo)
  const BrandLogo = ({ compact = false, className = '' }: { compact?: boolean; className?: string }) => (
    compact ? (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <img src="/casinha.png" alt="Seazone" className="h-4 w-4 brightness-0 invert opacity-90 object-contain" />
        <span className="font-bold text-white/80 tracking-wide text-[9px]">SEAZONE</span>
      </div>
    ) : (
      <img src="/logo-seazone.png" alt="Seazone" className={`h-5 w-auto brightness-0 invert opacity-90 object-contain ${className}`} />
    )
  )

  // Paletas de variação (sempre dentro do brand)
  const VARIATION_PALETTES = [
    { gradient: `${SEAZONE_BRAND.colors.secondary}, ${SEAZONE_BRAND.colors.primary}`, accentColor: SEAZONE_BRAND.colors.accent, barColor: SEAZONE_BRAND.colors.primary },
    { gradient: `${SEAZONE_BRAND.colors.secondary}, ${SEAZONE_BRAND.colors.deepBlue}`, accentColor: SEAZONE_BRAND.colors.primary, barColor: SEAZONE_BRAND.colors.accent },
    { gradient: `${SEAZONE_BRAND.colors.primary}, ${SEAZONE_BRAND.colors.royalBlue}`, accentColor: SEAZONE_BRAND.colors.lightBlue, barColor: SEAZONE_BRAND.colors.accent },
    { gradient: `${SEAZONE_BRAND.colors.deepBlue}, ${SEAZONE_BRAND.colors.secondary}`, accentColor: SEAZONE_BRAND.colors.accent, barColor: SEAZONE_BRAND.colors.mediumBlue },
  ]

  // Layouts de variação: posição do texto, tamanho do headline
  const VARIATION_LAYOUTS = [
    { textPos: 'bottom' as const, headlineSize: 'text-2xl', subSize: 'text-sm', align: 'text-left' },
    { textPos: 'center' as const, headlineSize: 'text-3xl', subSize: 'text-base', align: 'text-center' },
    { textPos: 'bottom' as const, headlineSize: 'text-xl', subSize: 'text-sm', align: 'text-left' },
    { textPos: 'top-text' as const, headlineSize: 'text-2xl', subSize: 'text-sm', align: 'text-left' },
  ]

  // Renderizar template estático no estilo Instagram Seazone
  const renderStaticTemplate = (creative: StaticCreative) => {
    const { template, imageUrl, texts, variation } = creative
    const hasImage = imageUrl && imageUrl !== ''
    const palette = VARIATION_PALETTES[variation % VARIATION_PALETTES.length]
    const layout = VARIATION_LAYOUTS[variation % VARIATION_LAYOUTS.length]

    // Template HERO
    if (template === 'hero') {
      const isCenterVar = layout.textPos === 'center'
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: SEAZONE_BRAND.colors.secondary }}>
          {hasImage && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: isCenterVar
            ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7))`
            : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.1) 100%)' }} />
          <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-10">
            <BrandLogo />
            {texts.badge && (
              <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={variation % 2 === 0
                  ? { background: palette.accentColor, color: '#fff' }
                  : { border: `2px solid ${palette.accentColor}`, color: palette.accentColor }}>
                {texts.badge}
              </div>
            )}
          </div>
          <div className={`absolute z-10 p-5 pb-6 ${isCenterVar
            ? 'inset-0 flex flex-col items-center justify-center text-center'
            : layout.textPos === 'top-text' ? 'top-16 left-0 right-0' : 'bottom-0 left-0 right-0'} ${layout.align}`}>
            <h2 className={`${layout.headlineSize} font-bold text-white leading-tight mb-1`}>{texts.headline}</h2>
            <p className={`${layout.subSize} text-white/70`}>{texts.subline}</p>
            <div className="mt-3 w-12 h-1 rounded-full" style={{ background: palette.barColor }} />
          </div>
        </div>
      )
    }

    // Template DADOS
    if (template === 'dados') {
      const bg = hasImage ? undefined : `linear-gradient(145deg, ${palette.gradient})`
      const headlineSizes = ['text-4xl', 'text-5xl', 'text-3xl', 'text-4xl']
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: bg || SEAZONE_BRAND.colors.secondary }}>
          {hasImage && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          {hasImage && <div className="absolute inset-0 bg-black/60" />}
          <div className="absolute inset-0 flex flex-col justify-between p-5 z-10">
            <div className="flex items-center justify-between">
              <BrandLogo />
              {texts.badge && (
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                  style={variation % 2 === 0
                    ? { border: `2px solid ${palette.accentColor}`, color: palette.accentColor }
                    : { background: palette.accentColor, color: '#fff' }}>
                  {texts.badge}
                </span>
              )}
            </div>
            <div className={layout.align}>
              <div className={`${headlineSizes[variation % 4]} font-bold text-white leading-tight mb-2`}>{texts.headline}</div>
              <div className={`${layout.subSize} text-white/60`}>{texts.subline}</div>
            </div>
            <div className={`flex ${layout.align === 'text-center' ? 'justify-center' : 'justify-start'}`}>
              <div className="w-10 h-1 rounded-full" style={{ background: palette.accentColor }} />
            </div>
          </div>
        </div>
      )
    }

    // Template LIFESTYLE
    if (template === 'lifestyle') {
      const isCenterVar = layout.textPos === 'center'
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: SEAZONE_BRAND.colors.secondary }}>
          {hasImage && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0" style={{ background: isCenterVar
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))'
            : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
          <div className="absolute top-0 left-0 right-0 p-5 z-10">
            <BrandLogo />
          </div>
          <div className={`absolute z-10 p-5 pb-6 ${isCenterVar
            ? 'inset-0 flex flex-col items-center justify-center text-center'
            : 'bottom-0 left-0 right-0'} ${layout.align}`}>
            <p className="text-xs uppercase tracking-[0.2em] mb-2 font-semibold" style={{ color: palette.accentColor }}>Seazone</p>
            <h2 className={`${layout.headlineSize} font-bold text-white leading-tight mb-1`}>{texts.headline}</h2>
            <p className={`${layout.subSize} text-white/60`}>{texts.subline}</p>
          </div>
        </div>
      )
    }

    // Template MÔNICA CTA
    if (template === 'monica_cta') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: `linear-gradient(145deg, ${palette.gradient})` }}>
          {hasImage && <img src={imageUrl} alt="Mônica" className="absolute inset-0 w-full h-[60%] object-contain object-top" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#00143D] via-[#00143D]/80 to-transparent" style={{ top: '35%' }} />
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-center z-10">
            <BrandLogo />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 pb-6 text-center z-10">
            <h2 className={`${layout.headlineSize} font-bold text-white mb-2 leading-tight`}>{texts.headline}</h2>
            <p className={`${layout.subSize} text-white/50 mb-4`}>{texts.subline}</p>
            {texts.cta && (
              <div className="inline-block px-6 py-2.5 rounded-full text-sm font-bold text-white"
                style={{ background: palette.accentColor }}>
                {texts.cta}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Template CARROSSEL INFO
    if (template === 'carrossel_info') {
      const isReversed = variation % 2 === 1
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: SEAZONE_BRAND.colors.secondary }}>
          {hasImage && <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-25" />}
          <div className={`absolute inset-0 flex flex-col ${isReversed ? 'justify-start' : 'justify-between'} p-5 z-10`}>
            <BrandLogo />
            <div className={isReversed ? 'mt-auto mb-12' : ''}>
              <div className="w-10 h-1 rounded-full mb-4" style={{ background: palette.barColor }} />
              <h2 className={`${layout.headlineSize} font-bold text-white leading-tight mb-2`}>{texts.headline}</h2>
              <p className={`${layout.subSize} text-white/50`}>{texts.subline}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: palette.accentColor }} />
              <span className="text-xs text-white/30 uppercase tracking-wider">Seazone Invest</span>
            </div>
          </div>
        </div>
      )
    }

    // Template DESTAQUE — usa compact na faixa estreita
    if (template === 'destaque') {
      const topBarColor = variation % 2 === 0 ? SEAZONE_BRAND.colors.primary : palette.accentColor
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ background: SEAZONE_BRAND.colors.secondary }}>
          {hasImage && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
          <div className="absolute top-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between z-10"
            style={{ background: `${topBarColor}ee` }}>
            <BrandLogo compact />
            {texts.badge && <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{texts.badge}</span>}
          </div>
          <div className={`absolute bottom-0 left-0 right-0 p-5 pb-6 z-10 ${layout.align}`}>
            <h2 className={`${layout.headlineSize} font-bold text-white leading-tight mb-1`}>{texts.headline}</h2>
            <p className={`${layout.subSize} text-white/60`}>{texts.subline}</p>
          </div>
        </div>
      )
    }

    return null
  }

  const getLogColor = (type: string) => {
    const colors: Record<string, string> = {
      success: 'text-emerald-400', error: 'text-red-400', warning: 'text-yellow-400',
      debug: 'text-white/30', info: 'text-blue-300',
    }
    return colors[type] || 'text-white/50'
  }

  return (
    <div className="min-h-screen gradient-hero relative">
      <div className="shape-blob w-[600px] h-[600px] bg-[#0055FF] top-[-200px] right-[-200px]" />
      <div className="shape-blob w-[400px] h-[400px] bg-[#FC6058] bottom-[20%] left-[-100px]" />
      <div className="shape-blob w-[500px] h-[500px] bg-[#6593FF] top-[40%] right-[-150px]" />

      {/* HEADER */}
      <header className="relative z-20 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image src="/logo-seazone.png" alt="Seazone" width={160} height={44} className="brightness-0 invert" />
              <div className="hidden sm:block h-6 w-px bg-white/20" />
              <span className="hidden sm:block text-sm text-white/50 font-light tracking-wide">Creative Engine</span>
              <span className="hidden sm:block text-[10px] bg-[#0055FF]/20 text-[#0055FF] px-2 py-0.5 rounded-full font-medium">v2 — Agentes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-breathe" />
              <span className="text-xs text-white/40">AI Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-12 md:pt-16 md:pb-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FC6058]" />
              <span className="text-xs text-white/60 font-medium tracking-wider uppercase">Pipeline de Agentes IA</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Crie seus<br />
              <span className="gradient-text">criativos</span><br />
              em segundos
            </h1>
            <p className="text-lg text-white/50 leading-relaxed max-w-md mb-8">
              6 agentes inteligentes trabalham em sequência: estratégia, roteiro, imagens, vídeos, narração e validação.
            </p>
            <a href="#gerar" className="btn-premium text-white font-semibold py-3.5 px-8 rounded-xl text-base inline-block">
              Começar a gerar
            </a>
          </div>
          <div className="flex justify-center md:justify-end animate-slide-in-right delay-300">
            <div className="house-container animate-float-slow">
              <div className="house-glow" />
              <div className="house-shape" />
              <img src="/monica.png" alt="Mônica - Apresentadora Seazone" className="monica-image" />
            </div>
          </div>
        </div>
      </section>

      {/* VISUALIZAÇÃO DO PIPELINE DE AGENTES */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 mb-4 uppercase tracking-wider">Pipeline de Agentes</h3>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {(Object.entries(AGENT_LABELS) as [AgentName, { label: string; icon: string }][]).map(([name, info], i) => {
              const trace = pipeline?.traces?.find(t => t.agent === name)
              const isActive = currentAgent === name
              const isDone = trace?.status === 'completed'
              const isFailed = trace?.status === 'failed'

              return (
                <div key={name} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-xs whitespace-nowrap ${
                    isActive ? 'border-[#0055FF] bg-[#0055FF]/20 text-white ring-2 ring-[#0055FF]/30' :
                    isDone ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                    isFailed ? 'border-red-500/30 bg-red-500/10 text-red-300' :
                    'border-white/10 bg-white/[0.02] text-white/30'
                  }`}>
                    <span>{info.icon}</span>
                    <span className="font-medium">{info.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF] animate-pulse" />}
                    {isDone && <span className="text-[10px]">OK</span>}
                    {isFailed && <span className="text-[10px]">!</span>}
                  </div>
                  {i < 5 && <div className={`w-4 h-px ${isDone ? 'bg-emerald-500/40' : 'bg-white/10'}`} />}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* GERADOR */}
      <section id="gerar" className="relative z-10 max-w-7xl mx-auto px-6 mb-16 scroll-mt-8">
        <div className="glass-card rounded-3xl p-8 animate-fade-in-up delay-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-blue flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Novo Criativo</h2>
              <p className="text-sm text-white/40">O roteiro é gerado automaticamente a partir do seu briefing</p>
            </div>
          </div>

          {/* BRIEFING */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <label className="block text-sm font-medium text-white/60">Briefing do empreendimento</label>
              <div className="flex gap-1">
                {(['structured', 'freetext', 'url'] as const).map(mode => (
                  <button key={mode} onClick={() => setBriefingMode(mode)}
                    className={`text-xs px-3 py-1 rounded-full transition-all ${briefingMode === mode ? 'bg-[#0055FF] text-white' : 'bg-white/10 text-white/40'}`}>
                    {mode === 'structured' ? 'Estruturado' : mode === 'freetext' ? 'Texto livre' : 'Via Link'}
                  </button>
                ))}
              </div>
            </div>

            {briefingMode === 'url' && (
              <div className="mb-4">
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    value={briefingUrl}
                    onChange={e => setBriefingUrl(e.target.value)}
                    placeholder="https://exemplo.com/briefing-empreendimento"
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#0055FF]/50"
                  />
                  <button
                    onClick={loadBriefingFromUrl}
                    disabled={urlLoading}
                    className="btn-premium text-white font-medium py-3 px-6 rounded-lg text-sm disabled:opacity-30"
                  >
                    {urlLoading ? 'Lendo...' : 'Extrair'}
                  </button>
                </div>
                {urlMessage && (
                  <p className={`text-xs ${urlMessage.includes('sucesso') ? 'text-emerald-300' : 'text-yellow-300'}`}>
                    {urlMessage}
                  </p>
                )}
              </div>
            )}

            {(briefingMode === 'structured' || briefingMode === 'url') && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  { field: 'nomeEmpreendimento' as const, label: 'Nome do empreendimento' },
                  { field: 'localizacao' as const, label: 'Localização' },
                  { field: 'tipo' as const, label: 'Tipo' },
                  { field: 'roi' as const, label: 'ROI' },
                  { field: 'rendimentoMensal' as const, label: 'Rendimento mensal' },
                  { field: 'ticketMedio' as const, label: 'Ticket médio' },
                  { field: 'valorizacao' as const, label: 'Valorização' },
                  { field: 'publicoAlvo' as const, label: 'Público-alvo' },
                  { field: 'cta' as const, label: 'CTA (chamada para ação)' },
                ]).map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-xs text-white/40 mb-1 block">{label}</label>
                    <input
                      type="text"
                      value={briefing[field] as string}
                      onChange={e => updateBriefing(field, e.target.value)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#0055FF]/50"
                    />
                  </div>
                ))}
              </div>
            )}

            {briefingMode === 'freetext' && (
              <textarea
                value={freeTextBriefing}
                onChange={(e) => setFreeTextBriefing(e.target.value)}
                placeholder="Cole aqui o briefing completo do empreendimento..."
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white placeholder-white/20 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[#0055FF]/50 transition-all resize-none"
              />
            )}
          </div>

          {/* UPLOADS */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-white/60">
                Imagens de referência <span className="text-white/30">(opcionais)</span>
              </label>
              <button onClick={loadLancamentoImages} type="button"
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                style={{ background: `${SEAZONE_BRAND.colors.primary}20`, color: SEAZONE_BRAND.colors.primary, border: `1px solid ${SEAZONE_BRAND.colors.primary}40` }}>
                Carregar fotos do lançamento
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {([
                { key: 'fachada', label: 'Fachada', icon: '🏢' },
                { key: 'lifestyle', label: 'Interior', icon: '🛋️' },
                { key: 'rooftop', label: 'Rooftop', icon: '🏊' },
                { key: 'localizacao', label: 'Localização', icon: '📍' },
              ] as const).map(({ key, label, icon }) => {
                const images = refPreviews[key] || []
                return (
                  <div key={key} className="relative">
                    <input type="file" accept="image/*" multiple
                      onChange={(e) => e.target.files && e.target.files.length > 0 && handleImageUpload(key, e.target.files)}
                      className="hidden" id={`upload-${key}`} />
                    <label htmlFor={`upload-${key}`}
                      className={`block cursor-pointer rounded-xl border-2 border-dashed transition-all ${
                        images.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/20 bg-white/[0.02] hover:border-white/40'
                      } p-4 text-center`}>
                      {images.length > 0 ? (
                        <div>
                          <div className="grid grid-cols-3 gap-1 mb-2">
                            {images.slice(0, 6).map((img, i) => (
                              <div key={i} className="relative group/thumb">
                                <img src={img} alt={`${label} ${i + 1}`} className="w-full h-16 object-cover rounded" />
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage(key, i) }}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">x</button>
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-emerald-300">{images.length} foto(s) — clique p/ adicionar</span>
                        </div>
                      ) : (
                        <div className="py-4">
                          <div className="text-3xl mb-2">{icon}</div>
                          <div className="text-sm text-white/50 font-medium">{label}</div>
                          <div className="text-xs text-white/30 mt-1">Clique para enviar (múltiplas)</div>
                        </div>
                      )}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* FORMATO + MODO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Formato</label>
              <div className="flex gap-3">
                {[
                  { value: '9:16', label: '9:16', desc: 'Stories / Reels' },
                  { value: '4:5', label: '4:5', desc: 'Feed Instagram' },
                  { value: '16:9', label: '16:9', desc: 'YouTube' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setAspectRatio(opt.value)}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      aspectRatio === opt.value ? 'border-[#0055FF] bg-[#0055FF]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}>
                    <div className={`font-bold text-sm ${aspectRatio === opt.value ? 'text-white' : 'text-white/70'}`}>{opt.label}</div>
                    <div className="text-xs text-white/30 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Saída</label>
              <div className="flex gap-3">
                {[
                  { value: 'images' as OutputMode, label: 'Imagens', icon: '🖼️' },
                  { value: 'videos' as OutputMode, label: 'Vídeos', icon: '🎬' },
                  { value: 'both' as OutputMode, label: 'Ambos', icon: '📦' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setOutputMode(opt.value)}
                    className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                      outputMode === opt.value ? 'border-[#0055FF] bg-[#0055FF]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}>
                    <div className="text-lg mb-1">{opt.icon}</div>
                    <div className={`font-bold text-sm ${outputMode === opt.value ? 'text-white' : 'text-white/70'}`}>{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SELETOR DE CENAS */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-white/60 mb-4">Tipos de criativos</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {CREATIVE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => toggleType(opt.value)}
                  className={`group relative p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                    selectedTypes.includes(opt.value)
                      ? opt.isFixed ? 'border-[#FC6058] bg-[#FC6058]/10' : opt.needsRef ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#0055FF] bg-[#0055FF]/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}>
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className={`font-semibold text-sm ${selectedTypes.includes(opt.value) ? 'text-white' : 'text-white/70'}`}>{opt.label}</div>
                  <div className="text-xs text-white/30 mt-1">{opt.description}</div>
                  {opt.isFixed && <div className="text-[10px] text-[#FC6058] mt-1 font-medium">Foto real</div>}
                  {opt.needsRef && (!refPreviews[opt.value] || refPreviews[opt.value].length === 0) && <div className="text-[10px] text-yellow-400 mt-1 font-medium">Sem ref: IA gera</div>}
                  {opt.needsRef && refPreviews[opt.value] && refPreviews[opt.value].length > 0 && <div className="text-[10px] text-emerald-400 mt-1 font-medium">{refPreviews[opt.value].length} ref(s)</div>}
                  {selectedTypes.includes(opt.value) && (
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                      opt.isFixed ? 'bg-[#FC6058]' : opt.needsRef ? 'bg-emerald-500' : 'bg-[#0055FF]'
                    }`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* PREVIEW DO ROTEIRO */}
          {selectedTypes.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <label className="block text-sm font-medium text-white/60">Roteiro do briefing</label>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Dinâmico</span>
              </div>
              <div className="space-y-2">
                {selectedTypes.map((type, i) => {
                  const option = CREATIVE_OPTIONS.find(o => o.value === type)
                  const b = briefing
                  const narr = getNarrationPreview(type, b)
                  return (
                    <div key={type} className="flex gap-3 items-start p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-full bg-[#0055FF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-[#0055FF]">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{option?.icon}</span>
                          <span className="text-sm font-medium text-white/80">{option?.label}</span>
                          {outputMode !== 'images' && <span className="text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">5s</span>}
                        </div>
                        <p className="text-xs text-white/30 italic">&ldquo;{narr}&rdquo;</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-white/20 mt-2">
                Total: {selectedTypes.length} cenas &middot; ~{selectedTypes.length * 5}s &middot; {aspectRatio} &middot; {outputMode === 'images' ? 'imagens' : outputMode === 'videos' ? 'vídeos' : 'ambos'}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-sm flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Botão: Peças Estáticas (sem IA) */}
            <button onClick={generateStaticCreatives}
              className="w-full py-5 rounded-xl text-lg font-bold transition-all border-2 text-white hover:scale-[1.01]"
              style={{ borderColor: SEAZONE_BRAND.colors.accent, background: `${SEAZONE_BRAND.colors.accent}15` }}>
              <span className="flex items-center justify-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                Gerar Peças Estáticas
              </span>
              <span className="text-xs font-normal text-white/40 block mt-1">Fotos + branding + textos (sem IA externa)</span>
            </button>

            {/* Botão: Pipeline IA */}
            <button onClick={startGeneration} disabled={loading}
              className="w-full btn-premium text-white font-bold py-5 rounded-xl text-lg disabled:opacity-30 disabled:cursor-not-allowed">
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Pipeline de agentes em execução...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  Gerar Criativos com Agentes IA
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </span>
              )}
              <span className="text-xs font-normal text-white/40 block mt-1">Imagens + vídeos gerados por IA</span>
            </button>
          </div>
        </div>
      </section>

      {/* MODAL DE PREVIEW AMPLIADO */}
      {previewCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewCreative(null)}>
          <div className="relative max-h-[90vh] max-w-[500px] w-full" onClick={e => e.stopPropagation()}>
            {/* Botão fechar */}
            <button onClick={() => setPreviewCreative(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm flex items-center gap-1 z-10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Fechar
            </button>
            {/* Preview */}
            <div id={`preview-${previewCreative.id}`}
              className={`${aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'} rounded-2xl overflow-hidden shadow-2xl`}>
              {renderStaticTemplate(previewCreative)}
            </div>
            {/* Info + Variação + Download */}
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white capitalize">{previewCreative.category} — {STATIC_TEMPLATES.find(t => t.id === previewCreative.template)?.name}</p>
                <p className="text-xs text-white/40">{previewCreative.texts.headline} — Variação {previewCreative.variation + 1}/4</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { generateVariation(previewCreative.id); setPreviewCreative(prev => prev ? { ...prev, variation: (prev.variation + 1) % 4 } : null) }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:scale-105 border border-white/20 bg-white/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                  Variação
                </button>
                <button onClick={() => downloadCreative(previewCreative)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:scale-105"
                  style={{ background: SEAZONE_BRAND.colors.primary }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Baixar PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GALERIA DE CRIATIVOS ESTÁTICOS */}
      {showStaticSection && staticCreatives.length > 0 && (
        <section className="relative z-10 max-w-7xl mx-auto px-6 mb-16 animate-fade-in-up">
          <div className="glass-card rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${SEAZONE_BRAND.colors.accent}20` }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SEAZONE_BRAND.colors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Peças Estáticas</h2>
                  <p className="text-xs text-white/30">{staticCreatives.length} criativos — clique para ampliar</p>
                </div>
              </div>
              <button onClick={() => setShowStaticSection(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Fechar</button>
            </div>

            {/* Info do branding */}
            <div className="mb-6 p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Branding:</span>
              {[
                { name: 'Primary', color: SEAZONE_BRAND.colors.primary },
                { name: 'Navy', color: SEAZONE_BRAND.colors.secondary },
                { name: 'Coral', color: SEAZONE_BRAND.colors.accent },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: c.color }} />
                  <span className="text-[10px] text-white/40">{c.name}</span>
                </div>
              ))}
            </div>

            {/* Grid de peças */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {staticCreatives.map((creative) => (
                <div key={creative.id}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] transition-all hover:border-white/20 hover:scale-[1.01] cursor-pointer"
                  onClick={() => setPreviewCreative(creative)}>
                  {/* A peça renderizada com ID para download */}
                  <div id={`creative-${creative.id}`}
                    className={`${aspectRatio === '9:16' ? 'aspect-[9/16]' : aspectRatio === '4:5' ? 'aspect-[4/5]' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-video'} bg-white/5 relative overflow-hidden`}>
                    {renderStaticTemplate(creative)}
                    {/* Overlay hover: ampliar + variação + download */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center" title="Ampliar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); generateVariation(creative.id) }}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors" title="Nova variação">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); downloadCreative(creative) }}
                          className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors" title="Baixar PNG">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[11px] text-white/80 truncate capitalize">{creative.category}</h3>
                      <div className="flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); generateVariation(creative.id) }}
                          className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/70 transition-colors"
                          title="Gerar nova variação">
                          v{creative.variation + 1}
                        </button>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">{STATIC_TEMPLATES.find(t => t.id === creative.template)?.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/20 mt-4 text-center">
              {aspectRatio} &middot; Clique para ampliar &middot; Hover para baixar PNG
            </p>
          </div>
        </section>
      )}

      {/* BARRA DE PROGRESSO + LOGS EM TEMPO REAL */}
      {loading && (
        <section className="relative z-10 max-w-7xl mx-auto px-6 mb-8 animate-fade-in-up">
          <div className="glass-card rounded-2xl p-6">
            {/* Barra de progresso */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {currentAgent && <span className="text-sm">{AGENT_LABELS[currentAgent]?.icon}</span>}
                  <span className="text-sm font-medium text-white/70">{currentStep || 'Iniciando...'}</span>
                </div>
                <span className="text-sm font-bold text-[#0055FF]">{pipelineProgress}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#0055FF] to-[#6593FF] transition-all duration-500 ease-out"
                  style={{ width: `${pipelineProgress}%` }} />
              </div>
            </div>

            {/* Toggle logs */}
            <button onClick={() => setShowLogs(!showLogs)}
              className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1 mb-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${showLogs ? 'rotate-90' : ''}`}>
                <path d="M9 18l6-6-6-6" />
              </svg>
              {showLogs ? 'Ocultar logs' : 'Mostrar logs de execução'} ({pipelineLogs.length})
            </button>

            {/* Log de execução */}
            {showLogs && (
              <div ref={logContainerRef}
                className="max-h-60 overflow-y-auto rounded-xl bg-black/30 border border-white/5 p-3 font-mono text-[11px] space-y-0.5">
                {pipelineLogs.map((entry, i) => {
                  if (entry.type === 'agent_start') {
                    return (
                      <div key={i} className="text-[#0055FF] font-semibold">
                        [{entry.progress}%] {AGENT_LABELS[entry.agent!]?.icon} Iniciando: {entry.agent} — {entry.step}
                      </div>
                    )
                  }
                  if (entry.type === 'agent_end') {
                    const ok = (entry.data as any)?.success
                    return (
                      <div key={i} className={ok ? 'text-emerald-400' : 'text-red-400'}>
                        [{entry.progress}%] {ok ? 'OK' : 'FALHOU'}: {entry.agent}
                      </div>
                    )
                  }
                  if (entry.type === 'log' && entry.log) {
                    return (
                      <div key={i} className={getLogColor(entry.log.type)}>
                        [{entry.progress}%] [{entry.log.agent}] {entry.log.message}
                      </div>
                    )
                  }
                  if (entry.type === 'validation') {
                    const results = (entry.data as any)?.results as any[] || []
                    return (
                      <div key={i} className="border-t border-white/5 pt-1 mt-1">
                        <div className="text-white/50 font-semibold">Validação:</div>
                        {results.slice(0, 8).map((r: any, j: number) => (
                          <div key={j} className={r.passed ? 'text-emerald-400' : r.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                            {r.passed ? 'PASS' : 'FAIL'} {r.check}: {r.message}
                          </div>
                        ))}
                      </div>
                    )
                  }
                  if (entry.type === 'error') {
                    return <div key={i} className="text-red-400 font-semibold">ERRO: {(entry.data as any)?.error}</div>
                  }
                  return null
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* RESULTADO */}
      {pipeline && (
        <section className="relative z-10 max-w-7xl mx-auto px-6 mb-16 animate-fade-in-up">
          <div className="glass-card rounded-3xl p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Resultado</h2>
                  <p className="text-xs text-white/30">
                    {pipeline.briefing.nomeEmpreendimento} &middot; {pipeline.script.format} &middot; {pipeline.outputMode === 'images' ? 'Imagens' : pipeline.outputMode === 'videos' ? 'Vídeos' : 'Ambos'}
                    {pipeline.agentMode && <span className="ml-2 text-[#0055FF]">(Pipeline de Agentes)</span>}
                  </p>
                </div>
              </div>
              {statusBadge(pipeline.status)}
            </div>

            {/* Info briefing */}
            <div className="mb-6 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-xs text-white/40 mb-1">Briefing:</p>
              <p className="text-xs text-white/60">
                <strong>{pipeline.briefing.nomeEmpreendimento}</strong> — {pipeline.briefing.localizacao} &middot; ROI {pipeline.briefing.roi} &middot; {pipeline.briefing.rendimentoMensal}/mês
              </p>
            </div>

            {/* Rastreamento dos agentes */}
            {pipeline.traces && pipeline.traces.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-white/60">Rastreamento dos Agentes</span>
                  <span className="text-[10px] bg-[#0055FF]/20 text-[#0055FF] px-2 py-0.5 rounded-full">{pipeline.traces.length} agentes</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {pipeline.traces.map((trace) => (
                    <div key={trace.agent} className={`p-2 rounded-lg border ${
                      trace.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' :
                      trace.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                      'border-white/10 bg-white/[0.02]'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">{AGENT_LABELS[trace.agent]?.icon}</span>
                        <span className="text-[10px] font-semibold text-white/70">{AGENT_LABELS[trace.agent]?.label}</span>
                        <span className={`text-[9px] ml-auto ${trace.status === 'completed' ? 'text-emerald-400' : trace.status === 'failed' ? 'text-red-400' : 'text-white/30'}`}>
                          {trace.status === 'completed' ? 'OK' : trace.status === 'failed' ? 'FALHOU' : trace.status}
                        </span>
                      </div>
                      {trace.error && <p className="text-[9px] text-red-400">{trace.error}</p>}
                      {trace.filesGenerated && trace.filesGenerated.length > 0 && (
                        <p className="text-[9px] text-white/30">{trace.filesGenerated.length} arquivo(s)</p>
                      )}
                      {trace.promptUsed && (
                        <p className="text-[9px] text-white/20 truncate" title={trace.promptUsed}>Prompt: {trace.promptUsed.slice(0, 60)}...</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Perfil Mônica */}
            {pipeline.presenterProfile && (
              <div className="mb-6 p-4 rounded-xl bg-[#FC6058]/5 border border-[#FC6058]/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">🎬</span>
                  <span className="text-sm font-semibold text-[#FC6058]">Perfil da Apresentadora</span>
                  <span className="text-[10px] bg-[#FC6058]/20 text-[#FC6058] px-2 py-0.5 rounded-full">{pipeline.presenterProfile.name}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Refs</p>
                    <p className="text-xs text-white/70 mt-0.5">{pipeline.presenterProfile.totalImageRefs} img + {pipeline.presenterProfile.totalVideoRefs} vídeos</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Face</p>
                    <p className="text-xs text-white/70 mt-0.5">{pipeline.presenterProfile.preferredFaceFile || 'monica.png'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Voz</p>
                    <p className="text-xs mt-0.5">
                      {pipeline.presenterProfile.voiceSupported ? <span className="text-emerald-300">Clonada</span> : <span className="text-yellow-300">TTS genérico</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Fonte</p>
                    <p className="text-xs text-white/50 mt-0.5">Photos-3-001/</p>
                  </div>
                </div>
              </div>
            )}

            {/* Grid de criativos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pipeline.creatives.map((creative, i) => (
                <div key={i} className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] transition-all hover:border-white/20">
                  <div className="aspect-[9/16] bg-white/5 relative overflow-hidden">
                    {creative.imageUrl ? (
                      creative.isFixed ? (
                        <div className="w-full h-full relative" style={{ background: `linear-gradient(135deg, ${SEAZONE_BRAND.colors.primary} 0%, ${SEAZONE_BRAND.colors.secondary} 100%)` }}>
                          <img src={creative.imageUrl} alt={creative.label} className="w-full h-full object-contain" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <div className="text-white font-bold text-sm">{creative.scene?.screenText.title}</div>
                            <div className="text-white/70 text-xs">{creative.scene?.screenText.subtitle}</div>
                          </div>
                        </div>
                      ) : (
                        <img src={creative.imageUrl} alt={creative.label} className="w-full h-full object-cover" />
                      )
                    ) : creative.isHtml && creative.scene ? renderHtmlCreative(creative) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <svg className="animate-spin w-5 h-5 text-white/40 mx-auto mb-2" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          <div className="text-xs text-white/30">Gerando...</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-xs text-white/80 truncate">{creative.label}</h3>
                      {statusBadge(creative.status)}
                    </div>
                    {creative.error && <p className="text-xs text-red-400 mb-2">{creative.error}</p>}
                    {creative.presenterTrace && (
                      <div className="mb-2 p-2 rounded-lg bg-[#FC6058]/10 border border-[#FC6058]/20">
                        <span className="text-[9px] text-[#FC6058]">Ref. {creative.presenterTrace.profileName}</span>
                        {creative.isLipSync && <span className="text-[9px] text-emerald-400 ml-2">Lip-sync ativo</span>}
                        {creative.audioUrl && <span className="text-[9px] text-blue-400 ml-2">Voz clonada</span>}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {creative.imageUrl && !creative.isHtml && (
                        <a href={creative.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors text-white/60">Imagem</a>
                      )}
                      {creative.videoUrl && (
                        <a href={creative.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs btn-premium px-2 py-1 rounded-lg text-white">Vídeo</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* COMPOR VÍDEO FINAL */}
            {pipeline.status === 'completed' && pipeline.creatives.some(c => c.videoUrl) && (
              <div className="mt-8 pt-8 border-t border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Compor Vídeo Final</h3>
                    <p className="text-xs text-white/40">Narração + legendas do roteiro</p>
                  </div>
                </div>

                {composeError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-sm">{composeError}</div>}

                <button onClick={startCompose} disabled={composeLoading}
                  className="btn-premium text-white font-semibold py-3 px-6 rounded-xl text-sm disabled:opacity-30">
                  {composeLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Gerando narrações...
                    </span>
                  ) : 'Gerar Vídeo Completo'}
                </button>

                {composeJob && (
                  <div className="mt-6 space-y-3">
                    {composeJob.status === 'processing' && <span className="flex items-center gap-2 text-sm text-yellow-300"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Processando...</span>}
                    {composeJob.status === 'completed' && <span className="text-sm text-emerald-300">Composição concluída!</span>}
                    {composeJob.status === 'failed' && <span className="text-sm text-red-300">Erro: {composeJob.error}</span>}
                    {composeJob.results.length > 0 && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {(composeJob.sequence.length > 0
                            ? composeJob.sequence.map(t => composeJob.results.find(r => r.type === t)).filter(Boolean) as ComposeResult[]
                            : composeJob.results
                          ).map((result) => (
                            <div key={result.type} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                              <div className="relative aspect-[9/16] bg-black">
                                <video id={`video-${result.type}`} src={result.videoUrl} className="w-full h-full object-cover" muted playsInline controls
                                  onPlay={() => {
                                    const audio = document.getElementById(`audio-${result.type}`) as HTMLAudioElement
                                    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}) }
                                  }}
                                  onPause={() => { (document.getElementById(`audio-${result.type}`) as HTMLAudioElement)?.pause() }}
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pointer-events-none">
                                  <div className="text-white font-bold text-base drop-shadow-lg">{result.overlay.title}</div>
                                  {result.overlay.subtitle && <div className="text-white/80 text-xs drop-shadow-lg">{result.overlay.subtitle}</div>}
                                  {result.subtitleText && (
                                    <div className="mt-2 text-white/90 text-[11px] bg-black/50 rounded-md px-2 py-1 inline-block max-w-[90%]">{result.subtitleText}</div>
                                  )}
                                </div>
                              </div>
                              <div className="p-2">
                                <span className="text-xs font-medium text-white/60 capitalize">{result.type}</span>
                                {result.narrationAudio && <audio id={`audio-${result.type}`} src={result.narrationAudio} preload="auto" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-seazone.png" alt="Seazone" width={100} height={28} className="brightness-0 invert opacity-30" />
            <span className="text-xs text-white/20">Creative Engine v2</span>
          </div>
          <p className="text-xs text-white/20">Powered by Claude Code + Fal.ai + Pipeline de Agentes</p>
        </div>
      </footer>
    </div>
  )
}

function getNarrationPreview(type: CreativeType, b: BriefingData): string {
  const neighborhood = b.localizacao.split(',')[0].trim()
  const city = b.localizacao.split(',')[1]?.replace(/-\s*\w{2}$/, '').trim() || b.localizacao
  const previews: Record<CreativeType, string> = {
    localizacao: `${neighborhood}, um dos bairros que mais valorizam em ${city}.${b.valorizacao ? ` Valorização de ${b.valorizacao}.` : ''}`,
    fachada: `Conheça o ${b.nomeEmpreendimento}. Arquitetura moderna e design premium.`,
    roi: `ROI de ${b.roi}. Bem acima da Selic.`,
    rendimento: `Rendimento de ${b.rendimentoMensal}/mês. Renda passiva real.`,
    lifestyle: `Studios com design contemporâneo. Experiência premium.`,
    rooftop: `Rooftop com piscina e vista privilegiada.`,
    apresentadora: `Invista com inteligência. ${b.cta}.`,
  }
  return previews[type]
}
