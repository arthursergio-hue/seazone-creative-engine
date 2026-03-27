// Sistema de Agentes — tipos e interfaces base

export type AgentName =
  | 'EstrategistaCriativo'
  | 'GeradorDeRoteiro'
  | 'CriadorDeCriativos'
  | 'GeradorDePecas'
  | 'GeradorDeNarracao'
  | 'ValidadorDeCriativos'

export type AgentStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'blocked'

export interface AgentLogEntry {
  timestamp: string
  agent: AgentName
  message: string
  type: 'info' | 'success' | 'error' | 'warning' | 'debug'
  data?: Record<string, unknown>
}

export interface AgentTrace {
  agent: AgentName
  startedAt: string
  completedAt?: string
  status: AgentStatus
  input: Record<string, unknown>
  output?: Record<string, unknown>
  promptUsed?: string
  filesGenerated?: string[]
  logs: AgentLogEntry[]
  error?: string
}

export interface AgentResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  trace: AgentTrace
}

export interface AgentContext {
  pipelineId: string
  briefing: import('../lib/scriptGenerator').BriefingData
  format: string
  outputMode: import('../context/seazone').OutputMode
  referenceImages?: Record<string, string>
  // Dados passados entre agentes
  strategy?: StrategyOutput
  script?: import('../lib/scriptGenerator').GeneratedScript
  creatives?: CreativeOutput[]
  pieces?: PieceOutput[]
  narrations?: NarrationOutput[]
  validationResults?: ValidationResult[]
}

// Outputs específicos de cada agente

export interface StrategyOutput {
  targetAudience: string
  tone: string
  hook: string
  cta: string
  sceneOrder: string[]
  keyMessages: string[]
  brandAlignment: string
}

export interface CreativeOutput {
  type: string
  imageUrl: string
  videoUrl?: string
  status: 'completed' | 'failed'
  prompt?: string
  error?: string
}

export interface PieceOutput {
  type: string
  title: string
  subtitle: string
  overlayText: string
  hashtags: string[]
}

export interface NarrationOutput {
  type: string
  text: string
  audioBase64?: string
  audioUrl?: string
  provider: string
  isMonicaVoice: boolean
  duration?: number
}

export interface ValidationResult {
  check: string
  passed: boolean
  severity: 'error' | 'warning' | 'info'
  message: string
  agent?: AgentName
  suggestion?: string
}

// Interface base que todo agente implementa
export interface Agent<TInput = unknown, TOutput = unknown> {
  name: AgentName
  description: string
  execute(input: TInput, context: AgentContext, log: (msg: string, type?: AgentLogEntry['type']) => void): Promise<AgentResult<TOutput>>
}

// Estado do pipeline para SSE
export interface PipelineEvent {
  type: 'progress' | 'agent_start' | 'agent_end' | 'log' | 'validation' | 'error' | 'complete'
  pipelineId: string
  timestamp: string
  progress: number // 0-100
  currentAgent?: AgentName
  currentStep?: string
  data?: Record<string, unknown>
  log?: AgentLogEntry
}
