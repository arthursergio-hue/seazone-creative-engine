// Contexto da MARCA Seazone — constantes visuais e de identidade
// Nenhum conteúdo de empreendimento específico aqui — tudo vem do briefing

export const SEAZONE_BRAND = {
  name: 'Seazone',
  tagline: 'Investimento inteligente em imóveis de temporada',
  colors: {
    primary: '#0055FF',
    secondary: '#00143D',
    accent: '#FC6058',
    lightBlue: '#E8EFFE',
    mediumBlue: '#6593FF',
    deepBlue: '#00247A',
    royalBlue: '#0048D7',
    darkGrey: '#2E2E2E',
    grey: '#7C7C7C',
    background: '#FFFFFF',
  },
  typography: {
    fontFamily: 'Helvetica',
    weights: ['Thin', 'Light', 'Medium', 'Bold'],
  },
  tone: {
    voice: 'Profissional mas humano — dados concretos com credibilidade acessível',
    doNot: [
      'Linguagem corporativa engessada',
      'Informalidade excessiva ou gírias',
      'Promessas de ganho garantido',
      'Clichês imobiliários genéricos',
    ],
  },
  // Logo e assets fixos
  assets: {
    logo: '/logo-seazone.png',
    monicaPhoto: '/monica.png',
    casinha: '/casinha.png',
  },
}

// Templates visuais para criativos de dados financeiros (HTML/CSS, sem IA)
// Os VALORES são injetados dinamicamente pelo briefing
export function buildHtmlCreative(type: 'roi' | 'rendimento', data: { mainText: string; subText: string }) {
  const backgrounds: Record<string, string> = {
    roi: `linear-gradient(135deg, ${SEAZONE_BRAND.colors.secondary} 0%, ${SEAZONE_BRAND.colors.primary} 100%)`,
    rendimento: `linear-gradient(135deg, ${SEAZONE_BRAND.colors.secondary} 0%, ${SEAZONE_BRAND.colors.deepBlue} 100%)`,
  }
  const icons: Record<string, string> = {
    roi: '📈',
    rendimento: '💰',
  }
  return {
    background: backgrounds[type],
    mainText: data.mainText,
    subText: data.subText,
    icon: icons[type],
  }
}

// Tipos de cenas suportadas
export type CreativeType = 'localizacao' | 'fachada' | 'roi' | 'rendimento' | 'lifestyle' | 'rooftop' | 'apresentadora'

// Classificação dos tipos de geração
export const CREATIVE_CATEGORIES = {
  // Tipos que podem gerar imagem por IA (se não houver referência)
  aiGeneratable: ['localizacao', 'rooftop'] as CreativeType[],
  // Tipos que usam imagem de referência (upload)
  reference: ['fachada', 'lifestyle'] as CreativeType[],
  // Tipos renderizados como HTML/CSS (dados financeiros)
  html: ['roi', 'rendimento'] as CreativeType[],
  // Tipo fixo (foto real da Mônica)
  fixed: ['apresentadora'] as CreativeType[],
}

// Banco de imagens do lançamento — categorizadas por tipo
// Cada imagem foi otimizada (1200px, JPEG 85%) a partir dos renders originais
export const LANCAMENTO_IMAGES: Record<string, { path: string; category: CreativeType | 'drone' | 'interior'; label: string }[]> = {
  'Novo Campeche SPOT II': [
    // Fachada
    { path: '/images/lancamento/novo_campeche_spot_ii_02_v07.jpg', category: 'fachada', label: 'Fachada principal' },
    { path: '/images/lancamento/novo_campeche_spot_ii_09.jpg', category: 'fachada', label: 'Fachada lateral com vegetação' },
    // Localização / Drone
    { path: '/images/lancamento/1.jpg', category: 'localizacao', label: 'Vista aérea com logo' },
    { path: '/images/lancamento/videos_01__3_.mp4_snapshot_00.10.022.jpg', category: 'localizacao', label: 'Vista aérea praia' },
    { path: '/images/lancamento/novo_campeche_spot_ii_05_inser__o.jpg', category: 'localizacao', label: 'Inserção drone panorâmica' },
    { path: '/images/lancamento/novo_campeche_spot_ii_06_inser__o__nova_01_.jpg', category: 'localizacao', label: 'Inserção drone 01' },
    { path: '/images/lancamento/novo_campeche_spot_ii_06_inser__o__nova_02_.jpg', category: 'localizacao', label: 'Inserção drone 02' },
    { path: '/images/lancamento/novo_campeche_spot_ii_07.jpg', category: 'localizacao', label: 'Vista geral rooftop' },
    // Interior / Lifestyle
    { path: '/images/lancamento/freepik__fazer-a-mulher-img2-de-costas-perto-da-janela-admi__96753.jpeg', category: 'lifestyle', label: 'Studio com modelo' },
    { path: '/images/lancamento/freepik__recriar-imagem-na-vertical-sem-perder-contedo__2875.jpeg', category: 'lifestyle', label: 'Studio interior' },
    { path: '/images/lancamento/scene_27.jpg', category: 'lifestyle', label: 'Entrada unidade 101' },
    // Rooftop
    { path: '/images/lancamento/v_deo_02.jpeg', category: 'rooftop', label: 'Rooftop com piscina' },
    { path: '/images/lancamento/novo_campeche_spot_ii_01_v07.jpg', category: 'rooftop', label: 'Rooftop vista geral' },
  ],
}

// Modo de saída
export type OutputMode = 'images' | 'videos' | 'both'

// Configuração da Mônica — identidade preservada
// IMPORTANTE: A Mônica é uma entidade multimodal (imagem + vídeo + voz).
// O perfil completo está em src/lib/presenterProfile.ts
// A pasta de referência oficial é:
// G:\Meu Drive\02 - Projetos\Seazone\Projetos IA\Desafio - Ambrosi\materiais\briefing\Photos-3-001
export const MONICA_CONFIG = {
  imagePath: '/monica.png',
  // Regras: nunca gerar outra pessoa, sempre usar foto real como base
  // Permitido: troca de fundo, contexto, iluminação
  // Proibido: alterar rosto, gerar pessoa por IA
  // Proibido: gerar "mulher parecida" por IA — sempre usar referência real
  compositeBackground: `linear-gradient(135deg, ${SEAZONE_BRAND.colors.primary} 0%, ${SEAZONE_BRAND.colors.secondary} 100%)`,
  // Prompt para vídeo: descreve movimento, NÃO descreve outra pessoa
  videoPromptBase: 'Professional woman presenting confidently, subtle zoom in, warm natural lighting',
  // Pasta de referência oficial com vídeos da Mônica
  referenceFolder: 'G:/Meu Drive/02 - Projetos/Seazone/Projetos IA/Desafio - Ambrosi/materiais/briefing/Photos-3-001',
}
