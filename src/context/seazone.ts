// Contexto completo da marca Seazone para geração de criativos
export const SEAZONE_CONTEXT = {
  brand: {
    name: 'Seazone',
    tagline: 'Investimento inteligente em imóveis de temporada',
    tone: {
      voice: 'Profissional mas humano — nem formal demais, nem solto demais. Usa dados concretos para transmitir credibilidade, mas de forma acessível. Conversa de igual para igual, como um consultor de confiança que entende do assunto.',
      personality: ['Autoridade em investimento imobiliário', 'Transparente com números', 'Próximo e acessível, sem ser casual'],
      doNot: ['Usar linguagem corporativa engessada', 'Ser informal demais ou usar gírias', 'Fazer promessas de ganho garantido', 'Usar clichês imobiliários genéricos'],
    },
    colors: {
      primary: '#0055FF',       // Azul principal
      secondary: '#00143D',     // Azul escuro / Navy
      accent: '#FC6058',        // Coral / Salmon (casinha da logo)
      lightBlue: '#E8EFFE',     // Azul claro de fundo
      mediumBlue: '#6593FF',    // Azul médio
      deepBlue: '#00247A',      // Azul profundo
      royalBlue: '#0048D7',     // Azul royal
      darkGrey: '#2E2E2E',      // Cinza escuro para texto
      grey: '#7C7C7C',          // Cinza para texto secundário
      background: '#FFFFFF',
    },
    typography: {
      fontFamily: 'Helvetica',
      weights: ['Thin', 'Light', 'Medium', 'Bold'],
    },
    mission: 'Transformar o mercado imobiliário de aluguel por temporada, oferecendo a melhor experiência ao hóspede e maximizando retornos do investidor por meio de soluções tecnológicas inovadoras.',
    vision: 'Ser o maior e melhor grupo imobiliário de aluguel por temporada digital do Brasil.',
    taglines: ['Seu lugar fora de casa', 'Gestão de imóveis', 'Investimentos'],
  },

  personas: {
    primary: {
      name: 'Investidor Sudeste (SP/MG)',
      profile: 'Profissional 35-55 anos, renda alta, busca diversificar investimentos além de renda fixa. Orientado a ROI e dados.',
      painPoints: ['Rendimento da poupança/Selic baixo', 'Falta de tempo para gerir imóvel', 'Medo de investimento imobiliário distante'],
      motivators: ['ROI acima da Selic', 'Renda passiva mensal', 'Valorização patrimonial'],
    },
    secondary: {
      name: 'Investidor Sul (SC/PR/RS)',
      profile: 'Profissional ou empresário que já conhece Florianópolis. Busca oportunidade local com gestão profissional.',
      motivators: ['Proximidade geográfica', 'Conhecimento da região', 'Confiança na valorização local'],
    },
    tertiary: {
      name: 'Investidor Nacional (expansão)',
      profile: 'Investidor que busca diversificação geográfica e mercado de temporada em alta.',
      motivators: ['Turismo em crescimento', 'Florianópolis como destino premium', 'Gestão profissional Seazone'],
    },
  },
}

// Briefing específico do empreendimento Novo Campeche SPOT II
export const BRIEFING_SPOT_II = {
  empreendimento: {
    nome: 'Novo Campeche SPOT II',
    localizacao: 'Campeche, Florianópolis - SC',
    tipo: 'Empreendimento imobiliário de temporada',
  },

  financeiro: {
    ticketMedio: 'R$ 350.190,82',
    rendimentoMensal: 'R$ 5.500',
    roi: '16,40%',
    valorizacao: '81%',
  },

  pontosFortes: [
    { key: 'ROI', texto: 'ROI de 16,40% — acima da Selic', prioridade: 1 },
    { key: 'Localização', texto: 'Localização premium no Campeche, Florianópolis', prioridade: 2 },
    { key: 'Rendimento', texto: 'Rendimento mensal estimado de R$ 5.500', prioridade: 3 },
    { key: 'Fachada', texto: 'Fachada moderna e valorizada', prioridade: 4 },
    { key: 'Vista', texto: 'Vista privilegiada (complementar)', prioridade: 5 },
  ],

  estruturasVideo: [
    { id: 'A', sequencia: ['Localização', 'Fachada', 'ROI', 'Rendimento'], sigla: 'L|F|RO|RE' },
    { id: 'B', sequencia: ['Localização', 'ROI', 'Rendimento', 'Fachada'], sigla: 'L|RO|RE|F' },
    { id: 'C', sequencia: ['Fachada', 'ROI', 'Rendimento', 'Localização'], sigla: 'F|RO|RE|L' },
  ],

  duracoesVideo: [
    { tipo: 'longo', duracao: '30-40s', quantidade: 3 },
    { tipo: 'curto', duracao: '10-20s', quantidade: 2 },
  ],

  restricoesVisuais: [
    'Sem efeitos que escureçam a imagem',
    'Sem molduras ou desfoque lateral',
    'Pin de localização obrigatório',
    'Tom da apresentadora: autoridade e credibilidade',
  ],

  donts: [
    'Não mencionar ticket baixo',
    'Não mencionar vista para o mar nas unidades',
    'Não mencionar pé na areia',
    'Não mencionar exclusividade',
  ],
}

// Prompts base para geração de imagens — baseados nos materiais reais do Novo Campeche SPOT II
export const IMAGE_PROMPTS: Record<string, string> = {
  fachada: `Modern 4-story apartment building "Novo Campeche SPOT II", contemporary architecture with vertical wooden slat panels and concrete facade, large glass windows, lush tropical vegetation with palm trees and green plants at entrance, warm earth tones, wood and concrete materials, "seazone" sign on rooftop, Campeche Florianopolis Brazil, bright daylight, professional architectural photography, 8k quality`,

  localizacao: `Aerial drone view of Campeche neighborhood in Florianopolis Brazil, residential area with modern low-rise buildings close to the beach, turquoise ocean visible, green areas and tree-lined streets, location pin marker, sunny day, professional drone photography, vertical format, 8k quality`,

  roi: `Elegant minimalist financial infographic on dark navy background #1a1a2e, large text "16,40% ROI" in white and blue #0055FF, clean modern typography, subtle geometric accents, professional investment data visualization, Seazone brand style, premium feel, no clutter`,

  rendimento: `Clean modern financial graphic showing "R$ 5.500/mês" monthly income, elegant dark premium background with blue #0055FF accents, minimalist real estate investment visualization, clean typography, Seazone brand style, professional and trustworthy feel`,

  lifestyle: `Modern compact studio apartment interior, wooden headboard panel, textured grey concrete wall, comfortable bed with white linens and blue wave-pattern Seazone branded pillow, small grey sofa with cushions, warm ambient lighting, wall sconces, contemporary art on walls, light wood floor, premium boutique hotel feel, 8k quality`,

  rooftop: `Rooftop terrace with infinity pool overlooking Campeche neighborhood and ocean in background, warm wooden deck, clear blue sky, modern glass railing, tropical plants, premium real estate lifestyle, Florianopolis Brazil, golden hour lighting, 8k quality`,

  apresentadora: `Young confident Brazilian woman with long dark hair, wearing black Seazone branded t-shirt, warm genuine smile, pointing gesture, professional and approachable, white clean background, studio photography, authority and credibility, 8k quality`,
}

// Prompts para geração de vídeos (motion a partir das imagens)
export const VIDEO_PROMPTS: Record<string, string> = {
  fachada: 'Slow cinematic dolly shot revealing modern apartment building with wooden slat facade, gentle camera movement upward, tropical plants swaying slightly in breeze, professional real estate showcase',
  localizacao: 'Smooth aerial drone fly-over of coastal neighborhood, gentle descending camera revealing proximity to beach, golden hour, cinematic real estate video',
  roi: 'Subtle elegant zoom into financial data, numbers appearing with smooth fade-in animation, professional presentation style, minimal movement',
  rendimento: 'Gentle parallax effect on financial graphic, smooth professional animation, numbers transitioning smoothly, premium feel',
  lifestyle: 'Slow cinematic pan across modern studio apartment, warm natural light coming through window, gentle movement revealing details, cozy premium atmosphere',
  rooftop: 'Slow panoramic camera sweep across rooftop pool area, water reflecting sunlight, revealing ocean view in background, aspirational luxury lifestyle',
  apresentadora: 'Young woman smiling and walking confidently toward camera, subtle zoom, professional and approachable, warm natural lighting',
}
