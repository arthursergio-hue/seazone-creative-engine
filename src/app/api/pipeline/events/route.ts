// SSE endpoint — envia eventos do pipeline em tempo real
import { NextRequest } from 'next/server'
import { pipelineLogger } from '@/lib/pipelineLogger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const pipelineId = req.nextUrl.searchParams.get('id')

  if (!pipelineId) {
    return new Response(JSON.stringify({ error: 'Pipeline ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Enviar evento de conexão
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', pipelineId })}\n\n`))

      const unsubscribe = pipelineLogger.subscribe(pipelineId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

          // Fechar stream quando pipeline completar
          if (event.type === 'complete' || (event.type === 'error' && event.progress >= 100)) {
            setTimeout(() => {
              try { controller.close() } catch { /* already closed */ }
            }, 1000)
          }
        } catch {
          // Stream closed by client
        }
      })

      // Cleanup on abort
      req.signal.addEventListener('abort', () => {
        unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
