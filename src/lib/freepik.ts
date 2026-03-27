const QUEUE_BASE = 'https://queue.fal.run'

function getApiKey(): string {
  const key = process.env.FAL_KEY || process.env.FREEPIK_API_KEY
  if (!key) throw new Error('FAL_KEY ou FREEPIK_API_KEY não configurada')
  return key
}

function authHeaders() {
  return {
    'Authorization': `Key ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

// Parse seguro — lê texto e tenta converter para JSON
async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Resposta inesperada (${res.status}): ${text.slice(0, 200)}`)
  }
}

// Cache de URLs retornadas pela API (request_id -> { statusUrl, responseUrl })
const urlCache = new Map<string, { statusUrl: string; responseUrl: string }>()

// ===== GERAÇÃO DE IMAGENS (Flux Pro 1.1 via Fal.ai) =====

export async function generateImage(prompt: string, options?: {
  aspectRatio?: string
  seed?: number
}): Promise<{ taskId: string }> {
  const { width, height } = aspectRatioToSize(options?.aspectRatio || '9:16')

  const res = await fetch(`${QUEUE_BASE}/fal-ai/flux-pro/v1.1`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      width,
      height,
      ...(options?.seed && { seed: options.seed }),
    }),
  })

  const data = await safeJson(res)

  if (!res.ok) {
    throw new Error(`Fal.ai Image API error ${res.status}: ${JSON.stringify(data)}`)
  }

  // Guardar as URLs retornadas pela API
  urlCache.set(data.request_id, {
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  })

  console.log('[Fal.ai] Image queued:', data.request_id)
  return { taskId: data.request_id }
}

export async function getImageResult(taskId: string): Promise<{
  status: string
  imageUrl?: string
}> {
  const cached = urlCache.get(taskId)
  const statusUrl = cached?.statusUrl || `${QUEUE_BASE}/fal-ai/flux-pro/requests/${taskId}/status`
  const responseUrl = cached?.responseUrl || `${QUEUE_BASE}/fal-ai/flux-pro/requests/${taskId}`

  const statusRes = await fetch(statusUrl, {
    headers: { 'Authorization': `Key ${getApiKey()}` },
  })

  const statusData = await safeJson(statusRes)

  if (!statusRes.ok) {
    throw new Error(`Fal.ai Image Status error ${statusRes.status}: ${JSON.stringify(statusData)}`)
  }

  console.log('[Fal.ai] Image status:', taskId, statusData.status)

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${getApiKey()}` },
    })

    const resultData = await safeJson(resultRes)

    if (!resultRes.ok) {
      throw new Error(`Fal.ai Image Result error ${resultRes.status}: ${JSON.stringify(resultData)}`)
    }

    return {
      status: 'completed',
      imageUrl: resultData.images?.[0]?.url,
    }
  }

  if (statusData.status === 'FAILED' || statusData.error) {
    return { status: 'failed' }
  }

  return { status: 'processing' }
}

// ===== GERAÇÃO DE VÍDEOS (Kling 2.0 Master via Fal.ai) =====

export async function generateVideo(imageUrl: string, prompt: string, options?: {
  duration?: 5 | 10
  aspectRatio?: string
}): Promise<{ taskId: string }> {
  const res = await fetch(`${QUEUE_BASE}/fal-ai/kling-video/v2/master/image-to-video`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      duration: String(options?.duration || 5),
      aspect_ratio: options?.aspectRatio || '9:16',
    }),
  })

  const data = await safeJson(res)

  if (!res.ok) {
    throw new Error(`Fal.ai Video API error ${res.status}: ${JSON.stringify(data)}`)
  }

  // Guardar as URLs retornadas pela API
  urlCache.set(data.request_id, {
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  })

  console.log('[Fal.ai] Video queued:', data.request_id)
  return { taskId: data.request_id }
}

export async function getVideoResult(taskId: string): Promise<{
  status: string
  videoUrl?: string
}> {
  const cached = urlCache.get(taskId)
  const statusUrl = cached?.statusUrl || `${QUEUE_BASE}/fal-ai/kling-video/requests/${taskId}/status`
  const responseUrl = cached?.responseUrl || `${QUEUE_BASE}/fal-ai/kling-video/requests/${taskId}`

  const statusRes = await fetch(statusUrl, {
    headers: { 'Authorization': `Key ${getApiKey()}` },
  })

  const statusData = await safeJson(statusRes)

  if (!statusRes.ok) {
    throw new Error(`Fal.ai Video Status error ${statusRes.status}: ${JSON.stringify(statusData)}`)
  }

  console.log('[Fal.ai] Video status:', taskId, statusData.status)

  if (statusData.status === 'COMPLETED') {
    const resultRes = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${getApiKey()}` },
    })

    const resultData = await safeJson(resultRes)

    if (!resultRes.ok) {
      throw new Error(`Fal.ai Video Result error ${resultRes.status}: ${JSON.stringify(resultData)}`)
    }

    return {
      status: 'completed',
      videoUrl: resultData.video?.url,
    }
  }

  if (statusData.status === 'FAILED' || statusData.error) {
    return { status: 'failed' }
  }

  return { status: 'processing' }
}

// ===== UPLOAD de base64 para URL pública (via Fal.ai storage) =====

export async function uploadBase64Image(base64DataUrl: string): Promise<string> {
  // Extrair o tipo MIME e os bytes
  const match = base64DataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Formato base64 inválido')

  const mimeType = match[1]
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, 'base64')

  // Upload para Fal.ai storage
  const res = await fetch('https://fal.run/fal-ai/any-llm/storage/upload', {
    method: 'PUT',
    headers: {
      'Authorization': `Key ${getApiKey()}`,
      'Content-Type': mimeType,
    },
    body: buffer,
  })

  if (!res.ok) {
    // Fallback: retornar base64 mesmo (funciona para imagem, não para vídeo)
    console.warn('[Fal.ai] Upload failed, using base64 directly')
    return base64DataUrl
  }

  const data = await safeJson(res)
  return data.url || base64DataUrl
}

// ===== POLLING (espera resultado ficar pronto) =====

export async function waitForImage(taskId: string, maxAttempts = 60): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getImageResult(taskId)
    if (result.status === 'completed' && result.imageUrl) return result.imageUrl
    if (result.status === 'failed') throw new Error('Geração de imagem falhou')
    await new Promise(r => setTimeout(r, 3000))
  }
  throw new Error('Timeout: imagem não ficou pronta')
}

export async function waitForVideo(taskId: string, maxAttempts = 120): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getVideoResult(taskId)
    if (result.status === 'completed' && result.videoUrl) return result.videoUrl
    if (result.status === 'failed') throw new Error('Geração de vídeo falhou')
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error('Timeout: vídeo não ficou pronto')
}

// ===== UTILS =====

function aspectRatioToSize(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '9:16': return { width: 768, height: 1344 }
    case '4:5': return { width: 864, height: 1080 }
    case '16:9': return { width: 1344, height: 768 }
    case '1:1': return { width: 1024, height: 1024 }
    default: return { width: 768, height: 1344 }
  }
}
