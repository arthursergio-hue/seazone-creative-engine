// Gerador de roteiro dinâmico baseado no briefing do usuário
// Nenhum texto é hardcoded — tudo deriva dos dados do briefing

export interface BriefingData {
  nomeEmpreendimento: string
  localizacao: string
  tipo: string
  roi: string
  rendimentoMensal: string
  ticketMedio: string
  valorizacao: string
  pontosFortes: string[]
  diferenciais: string[]
  publicoAlvo: string
  cta: string // Call to action
}

export interface SceneScript {
  id: string
  type: CreativeSceneType
  title: string
  objective: string
  narration: string
  screenText: { title: string; subtitle: string }
  visualPrompt: string
  videoPrompt: string
  duration: number // seconds
  format: string // 9:16, 4:5, 16:9
  briefingOrigin: string // qual campo do briefing originou esta cena
}

export type CreativeSceneType =
  | 'localizacao'
  | 'fachada'
  | 'roi'
  | 'rendimento'
  | 'lifestyle'
  | 'rooftop'
  | 'apresentadora'

export interface GeneratedScript {
  briefing: BriefingData
  scenes: SceneScript[]
  totalDuration: number
  format: string
}

// Briefing padrão para fallback — Novo Campeche SPOT II
export const DEFAULT_BRIEFING: BriefingData = {
  nomeEmpreendimento: 'Novo Campeche SPOT II',
  localizacao: 'Campeche, Florianópolis - SC',
  tipo: 'Empreendimento imobiliário de temporada',
  roi: '16,40%',
  rendimentoMensal: 'R$ 5.500',
  ticketMedio: 'R$ 350.190,82',
  valorizacao: '81%',
  pontosFortes: [
    'ROI acima da Selic',
    'Localização premium no Campeche',
    'Rendimento mensal atrativo',
    'Arquitetura moderna',
    'Gestão profissional Seazone',
  ],
  diferenciais: [
    'Rooftop com piscina',
    'Studios compactos com design contemporâneo',
    'A poucos minutos da praia',
  ],
  publicoAlvo: 'Investidores 35-55 anos, renda alta, buscam diversificar investimentos',
  cta: 'Fale com um consultor agora',
}

// Gera o roteiro completo baseado no briefing e nos tipos selecionados
export function generateScript(
  briefing: BriefingData,
  selectedTypes: CreativeSceneType[],
  format: string = '9:16'
): GeneratedScript {
  const scenes: SceneScript[] = []

  for (const type of selectedTypes) {
    const scene = buildScene(type, briefing, format)
    if (scene) scenes.push(scene)
  }

  return {
    briefing,
    scenes,
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
    format,
  }
}

// Utilitário para pegar item aleatório de array
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildScene(
  type: CreativeSceneType,
  b: BriefingData,
  format: string
): SceneScript {
  const formatLabel = formatToLabel(format)
  const cityShort = extractCity(b.localizacao)
  const neighborhood = extractNeighborhood(b.localizacao)

  const generators: Record<CreativeSceneType, () => SceneScript> = {
    localizacao: () => {
      const visualVariations = [
        `Aerial drone view of ${neighborhood} neighborhood in ${cityShort} Brazil, residential area with modern buildings, ocean visible in background, green areas, sunny day, professional drone photography, ${formatLabel} format, 8k quality, real estate marketing`,
        `Bird's eye panoramic shot of ${neighborhood} in ${cityShort} Brazil, coastal area with palm trees and modern architecture, blue ocean on the horizon, bright tropical light, real estate aerial photography, ${formatLabel} format, ultra realistic`,
        `Wide angle drone photograph of ${neighborhood} district, ${cityShort} Brazil, showing beachfront proximity, lush vegetation between modern buildings, clear sky with scattered clouds, golden hour lighting, ${formatLabel} format, magazine quality`,
        `High altitude cinematic drone capture of ${neighborhood}, ${cityShort} Brazil, turquoise ocean meeting white sand beach, urban development with green corridors, warm sunset tones, professional real estate documentary style, ${formatLabel} format, 8k`,
        `Sweeping aerial perspective of ${neighborhood} coastline in ${cityShort} Brazil, modern residential towers surrounded by tropical nature, vibrant blue water, midday sun casting minimal shadows, architectural photography from above, ${formatLabel} format`,
      ]
      const videoVariations = [
        `Smooth aerial drone fly-over of coastal neighborhood, gentle descending camera revealing beach proximity, golden hour, cinematic real estate, ${formatLabel} format`,
        `Dynamic drone tracking shot gliding over rooftops toward the ocean, revealing the full neighborhood landscape, warm afternoon light, cinematic movement, ${formatLabel} format`,
        `Slow ascending drone reveal from street level to panoramic coastal view, tropical vegetation visible below, soft morning light, professional real estate footage, ${formatLabel} format`,
        `Orbital drone shot circling the neighborhood from above, ocean and beach coming into frame, golden sunset reflections on buildings, smooth cinematic motion, ${formatLabel} format`,
      ]
      const narrationVariations = [
        `${neighborhood}, um dos bairros que mais valorizam em ${cityShort}. Localização estratégica com toda a infraestrutura que você precisa. ${b.valorizacao ? `Valorização de ${b.valorizacao} na região.` : ''}`,
        `Bem-vindo ao ${neighborhood}. Uma das regiões mais procuradas de ${cityShort}, com ${b.valorizacao ? `${b.valorizacao} de valorização` : 'alto potencial de valorização'} e qualidade de vida incomparável.`,
        `${neighborhood}, em ${cityShort}. Praia, natureza e infraestrutura completa. ${b.valorizacao ? `A região já valorizou ${b.valorizacao}.` : 'Uma região em constante valorização.'}`,
        `Você conhece o ${neighborhood}? ${cityShort} tem um dos metros quadrados que mais valorizam no Brasil. ${b.valorizacao ? `Só nessa região, a valorização já passou de ${b.valorizacao}.` : ''}`,
      ]
      return {
        id: `scene_localizacao_${Date.now()}`,
        type: 'localizacao',
        title: `Localização — ${neighborhood}`,
        objective: `Mostrar a localização privilegiada de ${b.nomeEmpreendimento} e o potencial da região`,
        narration: pickRandom(narrationVariations),
        screenText: {
          title: neighborhood.toUpperCase(),
          subtitle: cityShort,
        },
        visualPrompt: pickRandom(visualVariations),
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `localizacao: ${b.localizacao}`,
      }
    },

    fachada: () => {
      const narrationVariations = [
        `Conheça o ${b.nomeEmpreendimento}. Arquitetura moderna, acabamento premium e design pensado para maximizar sua rentabilidade.`,
        `Esse é o ${b.nomeEmpreendimento}. Cada detalhe da fachada transmite sofisticação e alto padrão, do jeito que o investidor exige.`,
        `${b.nomeEmpreendimento}. Projeto arquitetônico moderno, materiais de primeira linha e uma presença que valoriza qualquer portfólio.`,
        `Apresentamos o ${b.nomeEmpreendimento}. Design contemporâneo que combina estética e funcionalidade para máxima rentabilidade.`,
      ]
      const visualVariations = [
        `Modern apartment building facade, premium architecture, tropical setting in ${cityShort} Brazil, professional real estate photography, ${formatLabel} format, 8k quality`,
        `Elegant residential building exterior with contemporary design, lush tropical landscaping, ${cityShort} Brazil, afternoon sunlight, architectural photography, ${formatLabel} format, ultra sharp`,
        `Striking modern facade of premium apartment building, glass and concrete details, tropical plants at entrance, ${cityShort} Brazil, blue sky background, ${formatLabel} format, commercial real estate photography`,
        `Contemporary residential tower with clean lines and premium finishes, tropical garden surroundings, ${cityShort} Brazil, warm golden hour light, professional architecture magazine style, ${formatLabel} format`,
      ]
      const videoVariations = [
        `Slow cinematic reveal of modern apartment building, gentle camera tilt upward, tropical plants swaying in breeze, warm daylight, professional real estate showcase, ${formatLabel} format`,
        `Elegant tracking shot approaching building entrance, revealing facade details and landscaping, afternoon light, smooth professional movement, ${formatLabel} format`,
        `Slow dolly forward toward the building facade, gradual tilt up revealing full structure against blue sky, warm natural lighting, premium real estate film, ${formatLabel} format`,
      ]
      return {
        id: `scene_fachada_${Date.now()}`,
        type: 'fachada',
        title: `Fachada — ${b.nomeEmpreendimento}`,
        objective: `Apresentar a arquitetura e o padrão do empreendimento ${b.nomeEmpreendimento}`,
        narration: pickRandom(narrationVariations),
        screenText: {
          title: b.nomeEmpreendimento.toUpperCase(),
          subtitle: b.tipo,
        },
        visualPrompt: pickRandom(visualVariations),
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `empreendimento: ${b.nomeEmpreendimento}`,
      }
    },

    roi: () => {
      const narrationVariations = [
        `ROI de ${b.roi.replace('.', ' vírgula ').replace(',', ' vírgula ')}. Isso é o que o ${b.nomeEmpreendimento} pode entregar para o seu investimento. Bem acima da Selic.`,
        `${b.roi.replace('.', ' vírgula ').replace(',', ' vírgula ')} de retorno sobre investimento. Enquanto a Selic rende pouco, o ${b.nomeEmpreendimento} entrega resultados reais.`,
        `Imagine um retorno de ${b.roi.replace('.', ' vírgula ').replace(',', ' vírgula ')} ao ano. Isso não é projeção, é o que o ${b.nomeEmpreendimento} já demonstra.`,
        `O ${b.nomeEmpreendimento} entrega ${b.roi.replace('.', ' vírgula ').replace(',', ' vírgula ')} de ROI. Muito acima do CDI e da renda fixa tradicional.`,
      ]
      const screenTitleVariations = [
        `${b.roi} ROI`,
        `ROI ${b.roi}`,
        `${b.roi} ao ano`,
        `Retorno: ${b.roi}`,
      ]
      const screenSubtitleVariations = [
        'Retorno acima da Selic',
        'Acima do CDI e da poupança',
        'Seu dinheiro trabalhando por você',
        'Retorno real comprovado',
      ]
      const videoVariations = [
        `Dramatic zoom into bold financial numbers, elegant fade-in animation, professional dark background, subtle light effects, ${formatLabel} format`,
        `Cinematic number counter animation reaching final value, sleek dark theme with blue accent glow, professional data visualization, ${formatLabel} format`,
        `Dynamic text reveal with particle effects, financial data appearing with impact, dark premium background, subtle lens flare, ${formatLabel} format`,
      ]
      return {
        id: `scene_roi_${Date.now()}`,
        type: 'roi',
        title: `ROI — ${b.roi}`,
        objective: `Destacar o retorno sobre investimento de ${b.roi} como diferencial financeiro`,
        narration: pickRandom(narrationVariations),
        screenText: {
          title: pickRandom(screenTitleVariations),
          subtitle: pickRandom(screenSubtitleVariations),
        },
        visualPrompt: '',
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `financeiro.roi: ${b.roi}`,
      }
    },

    rendimento: () => {
      const narrationVariations = [
        `Rendimento mensal estimado de ${formatCurrency(b.rendimentoMensal)}. Renda passiva real, com gestão profissional Seazone.`,
        `${formatCurrency(b.rendimentoMensal)} por mês na sua conta. Isso é renda passiva de verdade, com a Seazone cuidando de tudo.`,
        `Imagine receber ${formatCurrency(b.rendimentoMensal)} todo mês, sem precisar se preocupar com nada. A Seazone gerencia para você.`,
        `Com gestão profissional Seazone, seu imóvel pode gerar ${formatCurrency(b.rendimentoMensal)} mensais de rendimento estimado.`,
      ]
      const screenTitleVariations = [
        `${b.rendimentoMensal}/mês`,
        `${b.rendimentoMensal} mensais`,
        `Renda: ${b.rendimentoMensal}`,
      ]
      const screenSubtitleVariations = [
        'Rendimento mensal estimado',
        'Renda passiva real',
        'Na sua conta todo mês',
        'Gestão profissional Seazone',
      ]
      const videoVariations = [
        `Smooth parallax on financial data, numbers appearing with clean animation, premium dark background, subtle glow effects, ${formatLabel} format`,
        `Elegant money counter animation, numbers rolling up with smooth easing, dark blue premium backdrop, soft particle effects, ${formatLabel} format`,
        `Clean infographic animation revealing monthly income data, modern motion design, dark background with blue highlights, ${formatLabel} format`,
      ]
      return {
        id: `scene_rendimento_${Date.now()}`,
        type: 'rendimento',
        title: `Rendimento — ${b.rendimentoMensal}/mês`,
        objective: `Comunicar o rendimento mensal estimado como renda passiva real`,
        narration: pickRandom(narrationVariations),
        screenText: {
          title: pickRandom(screenTitleVariations),
          subtitle: pickRandom(screenSubtitleVariations),
        },
        visualPrompt: '',
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `financeiro.rendimentoMensal: ${b.rendimentoMensal}`,
      }
    },

    lifestyle: () => {
      const diferencialInterior = b.diferenciais.find(d => d.toLowerCase().includes('studio') || d.toLowerCase().includes('interior')) || 'Studios compactos com design contemporâneo'
      const narrationVariations = [
        `${diferencialInterior}. Cada detalhe pensado para proporcionar a melhor experiência ao hóspede.`,
        `O interior do ${b.nomeEmpreendimento} surpreende. ${diferencialInterior}. Projetado para encantar e gerar avaliações cinco estrelas.`,
        `Ambientes que encantam desde o primeiro momento. ${diferencialInterior}. Alta taxa de ocupação garantida pelo padrão de qualidade.`,
        `Design pensado para performance. ${diferencialInterior}. Hóspedes satisfeitos significam mais reservas e mais rendimento.`,
      ]
      const screenTextVariations = [
        { title: 'STUDIO PREMIUM', subtitle: 'Design contemporâneo' },
        { title: 'DESIGN QUE ENCANTA', subtitle: 'Experiência 5 estrelas' },
        { title: 'ALTO PADRÃO', subtitle: diferencialInterior },
        { title: 'EXPERIÊNCIA PREMIUM', subtitle: 'Cada detalhe importa' },
      ]
      const visualVariations = [
        `Modern studio apartment interior, warm natural light, contemporary design, premium finishes, ${cityShort} Brazil, ${formatLabel} format, 8k quality, interior photography`,
        `Luxurious compact studio with floor-to-ceiling windows, minimalist furniture, warm wood and neutral tones, natural sunlight streaming in, ${cityShort} Brazil, ${formatLabel} format, architectural digest style`,
        `Cozy modern apartment with open plan design, designer lighting fixtures, premium materials and textures, soft afternoon light, ${cityShort} Brazil, ${formatLabel} format, interior design magazine photography`,
        `Stylish studio apartment with balcony view, contemporary decor, crisp white linens on bed, potted plants, golden hour light through curtains, ${cityShort} Brazil, ${formatLabel} format, hospitality photography`,
      ]
      const videoVariations = [
        `Slow cinematic pan across modern studio apartment interior, warm natural light through window, gentle movement revealing design details, cozy premium atmosphere, ${formatLabel} format`,
        `Smooth dolly shot entering a sunlit studio, camera gliding past furniture revealing elegant design, soft natural lighting, luxury hospitality vibe, ${formatLabel} format`,
        `Gentle tracking shot through modern apartment interior, light playing on surfaces, slow reveal of panoramic window view, warm inviting atmosphere, ${formatLabel} format`,
      ]
      const chosenScreenText = pickRandom(screenTextVariations)
      return {
        id: `scene_lifestyle_${Date.now()}`,
        type: 'lifestyle',
        title: `Interior — ${b.nomeEmpreendimento}`,
        objective: `Mostrar o padrão interno das unidades e a experiência do hóspede`,
        narration: pickRandom(narrationVariations),
        screenText: chosenScreenText,
        visualPrompt: pickRandom(visualVariations),
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `diferenciais: ${b.diferenciais.join(', ')}`,
      }
    },

    rooftop: () => {
      const diferencialRooftop = b.diferenciais.find(d => d.toLowerCase().includes('rooftop') || d.toLowerCase().includes('piscina')) || 'Rooftop com piscina e vista privilegiada'
      const narrationVariations = [
        `${diferencialRooftop}. Um diferencial que eleva a experiência e a taxa de ocupação do seu imóvel.`,
        `Imagine seus hóspedes aproveitando este rooftop. ${diferencialRooftop}. Um diferencial que faz toda a diferença nas avaliações.`,
        `${diferencialRooftop}. Áreas de lazer como esta são o que transformam um bom imóvel em um investimento excepcional.`,
        `O rooftop do ${b.nomeEmpreendimento} é um espetáculo. ${diferencialRooftop}. Experiência premium que se traduz em alta ocupação.`,
      ]
      const screenTextVariations = [
        { title: 'ROOFTOP', subtitle: 'Piscina com vista' },
        { title: 'ÁREA DE LAZER', subtitle: 'Experiência exclusiva' },
        { title: 'ROOFTOP PREMIUM', subtitle: 'Vista para o mar' },
        { title: 'PISCINA & VISTA', subtitle: 'Lazer no topo' },
      ]
      const visualVariations = [
        `Rooftop terrace infinity pool overlooking beach and ocean, warm wooden deck, clear blue sky, modern glass railing, tropical plants, premium lifestyle, ${cityShort} Brazil, golden hour, ${formatLabel} format, cinematic photography, 8k quality`,
        `Stunning rooftop pool area with ocean panorama, contemporary lounge furniture, lush tropical plants, crystal clear water reflecting sunset sky, ${cityShort} Brazil, ${formatLabel} format, luxury travel photography`,
        `Aerial view of rooftop infinity pool merging with ocean horizon, minimalist deck design, ambient evening lighting, premium resort atmosphere, ${cityShort} Brazil, ${formatLabel} format, architectural photography, 8k`,
        `Rooftop terrace at golden hour, sparkling pool with ocean backdrop, modern wooden decking, glass balustrade, cocktail lounge area, tropical paradise vibe, ${cityShort} Brazil, ${formatLabel} format, lifestyle magazine quality`,
      ]
      const videoVariations = [
        `Slow panoramic sweep across rooftop pool, water reflecting golden sunlight, ocean view revealed in background, aspirational luxury, ${formatLabel} format`,
        `Cinematic dolly shot along rooftop edge, pool water glistening, panoramic ocean view unfolding, warm sunset colors, luxury real estate film, ${formatLabel} format`,
        `Gentle camera orbit around rooftop pool area, capturing 360 degree views of ocean and city, golden hour reflections on water, premium lifestyle footage, ${formatLabel} format`,
      ]
      const chosenScreenText = pickRandom(screenTextVariations)
      return {
        id: `scene_rooftop_${Date.now()}`,
        type: 'rooftop',
        title: `Rooftop — ${b.nomeEmpreendimento}`,
        objective: `Destacar a área de lazer e elevar a percepção de valor do empreendimento`,
        narration: pickRandom(narrationVariations),
        screenText: chosenScreenText,
        visualPrompt: pickRandom(visualVariations),
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `diferenciais: rooftop/piscina`,
      }
    },

    // APRESENTADORA MÔNICA — Entidade multimodal de referência
    // REGRAS:
    // - Sempre usar foto/vídeo real da pasta de referência (Photos-3-001)
    // - NUNCA gerar "outra mulher parecida" por IA
    // - visualPrompt vazio = não gerar imagem por IA, usar referência real
    // - videoPrompt descreve apenas movimento/enquadramento, NÃO descreve outra pessoa
    // - A narração aqui usa TTS genérico; quando voz clonada estiver disponível,
    //   o pipeline usará o voice provider do PresenterProfile automaticamente
    apresentadora: () => {
      const narrationVariations = [
        `Invista com inteligência. A Seazone cuida de tudo para você. ${b.cta}.`,
        `Quer saber mais sobre o ${b.nomeEmpreendimento}? ${b.cta}. A Seazone cuida de toda a gestão para você.`,
        `O ${b.nomeEmpreendimento} é a oportunidade que faltava no seu portfólio. ${b.cta}. Deixa que a Seazone resolve.`,
        `Não perca essa oportunidade. ${b.cta}. A Seazone está pronta para te ajudar a investir com segurança.`,
      ]
      const screenTextVariations = [
        { title: 'INVISTA COM INTELIGÊNCIA', subtitle: 'seazone.com.br' },
        { title: b.cta.toUpperCase(), subtitle: 'seazone.com.br' },
        { title: 'SEU PRÓXIMO INVESTIMENTO', subtitle: b.cta },
        { title: 'FALE CONOSCO', subtitle: `${b.nomeEmpreendimento} — seazone.com.br` },
      ]
      const videoVariations = [
        `Woman smiling and presenting confidently, subtle zoom in, professional and approachable, clean background with modern real estate context, warm natural lighting, ${formatLabel} format`,
        `Professional woman speaking to camera with warm smile, gentle push-in, soft bokeh background, natural studio lighting, ${formatLabel} format`,
        `Confident female presenter with friendly expression, slow cinematic zoom, blurred modern office background, warm key light, ${formatLabel} format`,
      ]
      const chosenScreenText = pickRandom(screenTextVariations)
      return {
        id: `scene_apresentadora_${Date.now()}`,
        type: 'apresentadora',
        title: 'Mônica — CTA Final',
        objective: `Fechar com chamada para ação usando a apresentadora real da Seazone (referência: Photos-3-001)`,
        narration: pickRandom(narrationVariations),
        screenText: chosenScreenText,
        visualPrompt: '', // Vazio propositalmente — usa foto real, não gera por IA
        videoPrompt: pickRandom(videoVariations),
        duration: 5,
        format,
        briefingOrigin: `cta: ${b.cta} | ref: PresenterProfile(monica-seazone-presenter)`,
      }
    },
  }

  return generators[type]()
}

// Gera legendas resumidas e impactantes a partir da narração
export function generateSubtitle(narration: string): string {
  // Legenda = versão resumida e impactante da narração
  // Remove frases longas, mantém núcleo da mensagem
  const sentences = narration.split(/[.!]/).filter(s => s.trim().length > 0)
  if (sentences.length <= 1) return narration.trim()

  // Pega as 2 frases mais curtas e impactantes
  const sorted = sentences
    .map(s => s.trim())
    .filter(s => s.length > 5)
    .sort((a, b) => a.length - b.length)

  return sorted.slice(0, 2).join('. ') + '.'
}

// Parse de briefing a partir de texto livre
export function parseBriefingFromText(text: string): Partial<BriefingData> {
  const partial: Partial<BriefingData> = {}

  // Tenta extrair ROI
  const roiMatch = text.match(/ROI[:\s]*de?\s*([\d,\.]+\s*%)/i)
  if (roiMatch) partial.roi = roiMatch[1]

  // Tenta extrair rendimento
  const rendMatch = text.match(/rendimento[:\s]*(R\$[\s\d\.,]+)/i)
  if (rendMatch) partial.rendimentoMensal = rendMatch[1].trim()

  // Tenta extrair ticket
  const ticketMatch = text.match(/ticket[:\s]*(R\$[\s\d\.,]+)/i)
  if (ticketMatch) partial.ticketMedio = ticketMatch[1].trim()

  // Tenta extrair nome do empreendimento
  const nomeMatch = text.match(/(?:empreendimento|projeto|nome)[:\s]*([^\n,\.]+)/i)
  if (nomeMatch) partial.nomeEmpreendimento = nomeMatch[1].trim()

  // Tenta extrair localização
  const locMatch = text.match(/(?:localiza[çc][ãa]o|endere[çc]o|bairro|cidade)[:\s]*([^\n\.]+)/i)
  if (locMatch) partial.localizacao = locMatch[1].trim()

  return partial
}

// Mescla briefing parcial (do texto livre) com o default
export function mergeBriefing(
  structured: Partial<BriefingData>,
  freeText?: string
): BriefingData {
  const fromText = freeText ? parseBriefingFromText(freeText) : {}

  return {
    nomeEmpreendimento: structured.nomeEmpreendimento || fromText.nomeEmpreendimento || DEFAULT_BRIEFING.nomeEmpreendimento,
    localizacao: structured.localizacao || fromText.localizacao || DEFAULT_BRIEFING.localizacao,
    tipo: structured.tipo || fromText.tipo || DEFAULT_BRIEFING.tipo,
    roi: structured.roi || fromText.roi || DEFAULT_BRIEFING.roi,
    rendimentoMensal: structured.rendimentoMensal || fromText.rendimentoMensal || DEFAULT_BRIEFING.rendimentoMensal,
    ticketMedio: structured.ticketMedio || fromText.ticketMedio || DEFAULT_BRIEFING.ticketMedio,
    valorizacao: structured.valorizacao || fromText.valorizacao || DEFAULT_BRIEFING.valorizacao,
    pontosFortes: structured.pontosFortes?.length ? structured.pontosFortes : DEFAULT_BRIEFING.pontosFortes,
    diferenciais: structured.diferenciais?.length ? structured.diferenciais : DEFAULT_BRIEFING.diferenciais,
    publicoAlvo: structured.publicoAlvo || fromText.publicoAlvo || DEFAULT_BRIEFING.publicoAlvo,
    cta: structured.cta || fromText.cta || DEFAULT_BRIEFING.cta,
  }
}

// Utils
function extractCity(localizacao: string): string {
  // "Campeche, Florianópolis - SC" -> "Florianópolis"
  const parts = localizacao.split(',')
  if (parts.length > 1) {
    return parts[1].replace(/-\s*\w{2}$/, '').trim()
  }
  return localizacao.trim()
}

function extractNeighborhood(localizacao: string): string {
  // "Campeche, Florianópolis - SC" -> "Campeche"
  return localizacao.split(',')[0].trim()
}

function formatToLabel(format: string): string {
  switch (format) {
    case '9:16': return 'vertical 9:16'
    case '4:5': return 'square-ish 4:5'
    case '16:9': return 'horizontal 16:9'
    default: return 'vertical 9:16'
  }
}

function formatCurrency(value: string): string {
  // "R$ 5.500" -> "5 mil e 500 reais"
  const num = value.replace(/R\$\s*/, '').replace(/\./g, '').replace(',', '.').trim()
  const parsed = parseFloat(num)
  if (isNaN(parsed)) return value

  if (parsed >= 1000) {
    const mil = Math.floor(parsed / 1000)
    const rest = Math.round(parsed % 1000)
    if (rest === 0) return `${mil} mil reais`
    return `${mil} mil e ${rest} reais`
  }
  return `${parsed} reais`
}
