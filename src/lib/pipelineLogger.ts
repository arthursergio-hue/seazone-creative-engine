// Pipeline Logger — sistema de log e progresso em tempo real via SSE

import type { PipelineEvent, AgentLogEntry, AgentName } from '@/agents/types'

type Listener = (event: PipelineEvent) => void

class PipelineLogger {
  private listeners = new Map<string, Set<Listener>>()
  private history = new Map<string, PipelineEvent[]>()
  private progress = new Map<string, number>()

  subscribe(pipelineId: string, listener: Listener): () => void {
    if (!this.listeners.has(pipelineId)) {
      this.listeners.set(pipelineId, new Set())
    }
    this.listeners.get(pipelineId)!.add(listener)

    // Enviar histórico
    const past = this.history.get(pipelineId) || []
    for (const event of past) {
      listener(event)
    }

    return () => {
      this.listeners.get(pipelineId)?.delete(listener)
    }
  }

  private emit(event: PipelineEvent) {
    if (!this.history.has(event.pipelineId)) {
      this.history.set(event.pipelineId, [])
    }
    this.history.get(event.pipelineId)!.push(event)

    const listeners = this.listeners.get(event.pipelineId)
    if (listeners) {
      listeners.forEach(listener => {
        try { listener(event) } catch { /* ignore */ }
      })
    }
  }

  progress_update(pipelineId: string, percent: number, step: string, agent?: AgentName) {
    this.progress.set(pipelineId, percent)
    this.emit({
      type: 'progress',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: percent,
      currentAgent: agent,
      currentStep: step,
    })
  }

  agent_start(pipelineId: string, agent: AgentName, description: string) {
    this.emit({
      type: 'agent_start',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: this.progress.get(pipelineId) || 0,
      currentAgent: agent,
      currentStep: description,
      data: { agent, description },
    })
  }

  agent_end(pipelineId: string, agent: AgentName, success: boolean) {
    this.emit({
      type: 'agent_end',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: this.progress.get(pipelineId) || 0,
      currentAgent: agent,
      data: { agent, success },
    })
  }

  log(pipelineId: string, agent: AgentName, message: string, type: AgentLogEntry['type'] = 'info') {
    const logEntry: AgentLogEntry = {
      timestamp: new Date().toISOString(),
      agent,
      message,
      type,
    }
    this.emit({
      type: 'log',
      pipelineId,
      timestamp: logEntry.timestamp,
      progress: this.progress.get(pipelineId) || 0,
      currentAgent: agent,
      log: logEntry,
    })
  }

  validation(pipelineId: string, results: { check: string; passed: boolean; message: string }[]) {
    this.emit({
      type: 'validation',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: this.progress.get(pipelineId) || 0,
      data: { results },
    })
  }

  error(pipelineId: string, message: string, agent?: AgentName) {
    this.emit({
      type: 'error',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: this.progress.get(pipelineId) || 0,
      currentAgent: agent,
      data: { error: message },
    })
  }

  complete(pipelineId: string, data: Record<string, unknown>) {
    this.progress.set(pipelineId, 100)
    this.emit({
      type: 'complete',
      pipelineId,
      timestamp: new Date().toISOString(),
      progress: 100,
      data,
    })
  }

  getHistory(pipelineId: string): PipelineEvent[] {
    return this.history.get(pipelineId) || []
  }

  getProgress(pipelineId: string): number {
    return this.progress.get(pipelineId) || 0
  }

  cleanup(pipelineId: string) {
    // Limpar após 30 min
    setTimeout(() => {
      this.listeners.delete(pipelineId)
      this.history.delete(pipelineId)
      this.progress.delete(pipelineId)
    }, 30 * 60 * 1000)
  }
}

// Singleton
export const pipelineLogger = new PipelineLogger()
