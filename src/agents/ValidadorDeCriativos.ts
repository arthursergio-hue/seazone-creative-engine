// Agente 6: Validador de Criativos
// Verifica qualidade, coerência e alinhamento com briefing/marca

import type { Agent, AgentContext, AgentResult, AgentTrace, ValidationResult, AgentLogEntry } from './types'
import { SEAZONE_BRAND } from '@/context/seazone'

interface ValidationReport {
  passed: boolean
  results: ValidationResult[]
  score: number // 0-100
  blockers: ValidationResult[]
}

export const ValidadorDeCriativos: Agent<AgentContext, ValidationReport> = {
  name: 'ValidadorDeCriativos',
  description: 'Valida roteiro, imagens, textos e branding. Bloqueia avanço se encontrar erros críticos.',

  async execute(input, context, log): Promise<AgentResult<ValidationReport>> {
    const trace: AgentTrace = {
      agent: 'ValidadorDeCriativos' as const,
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      input: { step: 'validation' },
      logs: [] as AgentLogEntry[],
    }

    try {
      log('Iniciando validação dos criativos...')

      const results: ValidationResult[] = []

      // 1. Validar se roteiro segue o briefing
      log('Verificando roteiro vs briefing...')
      results.push(...validateScriptVsBriefing(context))

      // 2. Validar se imagens foram geradas
      log('Verificando imagens geradas...')
      results.push(...validateCreatives(context))

      // 3. Validar legibilidade dos textos
      log('Verificando legibilidade dos textos...')
      results.push(...validateTextReadability(context))

      // 4. Validar branding
      log('Verificando alinhamento com marca Seazone...')
      results.push(...validateBranding(context))

      // 5. Validar narrações
      log('Verificando narrações...')
      results.push(...validateNarrations(context))

      // Calcular score
      const passed = results.filter(r => r.passed)
      const failed = results.filter(r => !r.passed)
      const blockers = failed.filter(r => r.severity === 'error')
      const warnings = failed.filter(r => r.severity === 'warning')
      const score = Math.round((passed.length / results.length) * 100)

      log(`Validação: ${passed.length}/${results.length} checks ok (score: ${score}%)`)

      if (blockers.length > 0) {
        for (const b of blockers) {
          log(`BLOQUEIO: ${b.check} — ${b.message}`, 'error')
        }
      }
      if (warnings.length > 0) {
        for (const w of warnings) {
          log(`Aviso: ${w.check} — ${w.message}`, 'warning')
        }
      }

      const report: ValidationReport = {
        passed: blockers.length === 0,
        results,
        score,
        blockers,
      }

      trace.status = blockers.length === 0 ? 'completed' : 'failed'
      trace.completedAt = new Date().toISOString()
      trace.output = { score, total: results.length, passed: passed.length, blockers: blockers.length }

      if (blockers.length > 0) {
        log(`Validação FALHOU — ${blockers.length} erro(s) bloqueante(s)`, 'error')
        return { success: false, data: report, error: `${blockers.length} erro(s) bloqueante(s)`, trace }
      }

      log('Validação aprovada', 'success')
      return { success: true, data: report, trace }
    } catch (err) {
      trace.status = 'failed'
      trace.error = err instanceof Error ? err.message : 'Erro desconhecido'
      log(`Falha na validação: ${trace.error}`, 'error')
      return { success: false, error: trace.error, trace }
    }
  },
}

function validateScriptVsBriefing(ctx: AgentContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const b = ctx.briefing
  const script = ctx.script

  if (!script) {
    results.push({
      check: 'roteiro_existe',
      passed: false,
      severity: 'error',
      message: 'Roteiro não foi gerado',
    })
    return results
  }

  // Verificar se nome do empreendimento aparece no roteiro
  const allNarration = script.scenes.map(s => s.narration).join(' ')
  results.push({
    check: 'nome_empreendimento',
    passed: allNarration.includes(b.nomeEmpreendimento),
    severity: 'warning',
    message: allNarration.includes(b.nomeEmpreendimento)
      ? 'Nome do empreendimento presente no roteiro'
      : `"${b.nomeEmpreendimento}" não encontrado nas narrações`,
    suggestion: 'Incluir nome do empreendimento em pelo menos uma cena',
  })

  // Verificar se ROI aparece
  if (b.roi && script.scenes.some(s => s.type === 'roi')) {
    results.push({
      check: 'roi_consistente',
      passed: allNarration.includes(b.roi.replace('.', ' vírgula ').replace(',', ' vírgula ')) || allNarration.includes(b.roi),
      severity: 'warning',
      message: 'Valor de ROI consistente com briefing',
    })
  }

  // Verificar duração total
  results.push({
    check: 'duracao_total',
    passed: script.totalDuration >= 10 && script.totalDuration <= 120,
    severity: 'warning',
    message: `Duração total: ${script.totalDuration}s (ideal: 10-120s)`,
  })

  // Verificar se tem CTA
  results.push({
    check: 'cta_presente',
    passed: allNarration.toLowerCase().includes('consultor') || allNarration.toLowerCase().includes('seazone') || script.scenes.some(s => s.type === 'apresentadora'),
    severity: 'warning',
    message: 'CTA (chamada para ação) presente',
  })

  return results
}

function validateCreatives(ctx: AgentContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const creatives = ctx.creatives || []

  results.push({
    check: 'criativos_gerados',
    passed: creatives.length > 0,
    severity: 'error',
    message: creatives.length > 0
      ? `${creatives.length} criativos gerados`
      : 'Nenhum criativo gerado',
  })

  const failed = creatives.filter(c => c.status === 'failed')
  if (failed.length > 0) {
    results.push({
      check: 'criativos_falhas',
      passed: false,
      severity: failed.length > creatives.length / 2 ? 'error' : 'warning',
      message: `${failed.length} criativo(s) falharam: ${failed.map(f => f.type).join(', ')}`,
      suggestion: 'Verificar prompts e conexão com API de geração',
    })
  }

  // Verificar se apresentadora usa foto real (não gerada por IA)
  const presenter = creatives.find(c => c.type === 'apresentadora')
  if (presenter) {
    results.push({
      check: 'apresentadora_foto_real',
      passed: !presenter.prompt?.includes('Style:'),
      severity: 'error',
      message: 'Apresentadora deve usar foto real, não gerada por IA',
      suggestion: 'Nunca gerar outra mulher por IA. Sempre usar referência real.',
    })
  }

  return results
}

function validateTextReadability(ctx: AgentContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const script = ctx.script

  if (!script) return results

  for (const scene of script.scenes) {
    // Título não muito longo (cabe no overlay)
    const titleOk = scene.screenText.title.length <= 30
    results.push({
      check: `texto_titulo_${scene.type}`,
      passed: titleOk,
      severity: 'warning',
      message: titleOk
        ? `Título ${scene.type} legível (${scene.screenText.title.length} chars)`
        : `Título ${scene.type} muito longo: ${scene.screenText.title.length} chars (max 30)`,
      suggestion: 'Encurtar título para caber no overlay do vídeo',
    })

    // Narração não muito longa para a duração
    const wordsPerSecond = 2.5
    const maxWords = scene.duration * wordsPerSecond
    const wordCount = scene.narration.split(/\s+/).length
    const narrationOk = wordCount <= maxWords * 1.5 // margem de 50%
    results.push({
      check: `narracao_duracao_${scene.type}`,
      passed: narrationOk,
      severity: 'info',
      message: narrationOk
        ? `Narração ${scene.type}: ${wordCount} palavras para ${scene.duration}s`
        : `Narração ${scene.type} pode ser longa: ${wordCount} palavras para ${scene.duration}s`,
    })
  }

  return results
}

function validateBranding(ctx: AgentContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const script = ctx.script

  if (!script) return results

  const allText = script.scenes.map(s => `${s.narration} ${s.screenText.title}`).join(' ')

  // Verificar linguagem proibida
  for (const rule of SEAZONE_BRAND.tone.doNot) {
    const forbidden = rule.toLowerCase()
    if (forbidden.includes('garantido') && allText.toLowerCase().includes('garantido')) {
      results.push({
        check: 'brand_linguagem_proibida',
        passed: false,
        severity: 'error',
        message: `Texto contém linguagem proibida: "garantido" — ${rule}`,
        suggestion: 'Remover promessas de ganho garantido',
      })
    }
  }

  // Verificar se CTA final é seazone.com.br
  const lastScene = script.scenes[script.scenes.length - 1]
  if (lastScene) {
    results.push({
      check: 'brand_cta_seazone',
      passed: lastScene.screenText.subtitle?.includes('seazone') || lastScene.narration?.includes('Seazone'),
      severity: 'info',
      message: 'Seazone presente no CTA final',
    })
  }

  // Check geral de brand
  results.push({
    check: 'brand_alignment',
    passed: true,
    severity: 'info',
    message: `Tom: ${SEAZONE_BRAND.tone.voice}`,
  })

  return results
}

function validateNarrations(ctx: AgentContext): ValidationResult[] {
  const results: ValidationResult[] = []
  const narrations = ctx.narrations || []

  if (narrations.length === 0) {
    results.push({
      check: 'narracoes_geradas',
      passed: false,
      severity: 'warning',
      message: 'Nenhuma narração gerada ainda',
    })
    return results
  }

  const withAudio = narrations.filter(n => n.audioBase64)
  results.push({
    check: 'narracoes_audio',
    passed: withAudio.length > 0,
    severity: withAudio.length === 0 ? 'error' : 'info',
    message: `${withAudio.length}/${narrations.length} narrações com áudio`,
  })

  const monicaVoice = narrations.some(n => n.isMonicaVoice)
  results.push({
    check: 'voz_monica',
    passed: monicaVoice,
    severity: 'info',
    message: monicaVoice ? 'Usando voz clonada da Mônica' : 'Usando TTS genérico (voz clonada não disponível)',
  })

  return results
}
