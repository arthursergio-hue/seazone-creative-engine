const API_BASE = 'https://api.freepik.com'

function getApiKey(): string {
  const key = process.env.FREEPIK_API_KEY
  if (!key) throw new Error('FREEPIK_API_KEY não configurada')
  return key
}

function headers() {
  return {
    'x-freepik-api-key': getApiKey(),
    'Content-Type': 'application/json',
  }
}

// ===== GERAÇÃO DE IMAGENS (Flux 2 Pro) =====

export async function generateImage(prompt: string, options?: {
  aspectRatio?: string
  seed?: number
}): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/v1/ai/text-to-image/flux-2-pro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt,
      aspect_ratio: options?.aspectRatio || '16:9',
      ...(options?.seed && { seed: options.seed }),
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Image API error ${res.status}: ${error}`)
  }

  const data = await res.json()
  // Formato real: { data: { task_id: "...", status: "CREATED", generated: [] } }
  return { taskId: data.data.task_id }
}

export async function getImageResult(taskId: string): Promise<{
  status: string
  imageUrl?: string
}> {
  const res = await fetch(`${API_BASE}/v1/ai/text-to-image/flux-2-pro/${taskId}`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Image Status error ${res.status}: ${error}`)
  }

  const data = await res.json()
  // Formato real: { data: { task_id, status: "COMPLETED", generated: ["url1", ...] } }
  const status = data.data.status
  const imageUrl = data.data.generated?.[0]

  return {
    status: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'processing',
    imageUrl,
  }
}

// ===== GERAÇÃO DE VÍDEOS (Kling O1) =====

export async function generateVideo(imageUrl: string, prompt: string, options?: {
  duration?: 5 | 10
  aspectRatio?: '16:9' | '9:16' | '1:1'
}): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/v1/ai/image-to-video/kling-o1-std`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      first_frame: imageUrl,
      prompt,
      duration: options?.duration || 5,
      aspect_ratio: options?.aspectRatio || '16:9',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Video API error ${res.status}: ${error}`)
  }

  const data = await res.json()
  return { taskId: data.data.task_id }
}

export async function getVideoResult(taskId: string): Promise<{
  status: string
  videoUrl?: string
}> {
  const res = await fetch(`${API_BASE}/v1/ai/image-to-video/kling-o1/${taskId}`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Video Status error ${res.status}: ${error}`)
  }

  const data = await res.json()
  const status = data.data?.status || data.status
  const videoUrl = data.data?.generated?.[0] || data.data?.video?.url || data.data?.result?.url

  return {
    status: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'processing',
    videoUrl,
  }
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
