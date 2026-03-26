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

// ===== GERAÇÃO DE IMAGENS COM REFERÊNCIA (Flux Kontext Pro) =====
// Usa imagem de referência para manter consistência (ex: Mônica)

export async function generateImageWithReference(
  prompt: string,
  referenceImageUrl: string,
  options?: { aspectRatio?: string; seed?: number }
): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/v1/ai/text-to-image/flux-kontext-pro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt,
      image: referenceImageUrl,
      aspect_ratio: options?.aspectRatio || '9:16',
      ...(options?.seed && { seed: options.seed }),
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Kontext API error ${res.status}: ${error}`)
  }

  const data = await res.json()
  return { taskId: data.data.task_id }
}

// ===== GERAÇÃO DE IMAGENS (Flux 2 Pro - text-to-image) =====

export async function generateImage(prompt: string, options?: {
  aspectRatio?: string
  seed?: number
}): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/v1/ai/text-to-image/flux-2-pro`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      prompt,
      aspect_ratio: options?.aspectRatio || '9:16',
      ...(options?.seed && { seed: options.seed }),
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Image API error ${res.status}: ${error}`)
  }

  const data = await res.json()
  return { taskId: data.data.task_id }
}

export async function getImageResult(taskId: string, model: string = 'flux-2-pro'): Promise<{
  status: string
  imageUrl?: string
}> {
  const res = await fetch(`${API_BASE}/v1/ai/text-to-image/${model}/${taskId}`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Image Status error ${res.status}: ${error}`)
  }

  const data = await res.json()
  const status = data.data.status
  const imageUrl = data.data.generated?.[0]

  return {
    status: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'processing',
    imageUrl,
  }
}

// ===== GERAÇÃO DE VÍDEOS (Image-to-Video) =====

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
      duration: String(options?.duration || 5),
      aspect_ratio: options?.aspectRatio || '9:16',
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
  const videoUrl = data.data?.generated?.[0] || data.data?.video?.url

  return {
    status: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'processing',
    videoUrl,
  }
}

// ===== LIP SYNC =====

export async function lipSync(videoUrl: string, audioUrl: string): Promise<{ taskId: string }> {
  const res = await fetch(`${API_BASE}/v1/ai/lip-sync/latent-sync`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      video_url: videoUrl,
      audio_url: audioUrl,
      guidance_scale: 1,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Lip Sync API error ${res.status}: ${error}`)
  }

  const data = await res.json()
  return { taskId: data.data.task_id }
}

export async function getLipSyncResult(taskId: string): Promise<{
  status: string
  videoUrl?: string
}> {
  const res = await fetch(`${API_BASE}/v1/ai/lip-sync/latent-sync/${taskId}`, {
    method: 'GET',
    headers: headers(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Freepik Lip Sync Status error ${res.status}: ${error}`)
  }

  const data = await res.json()
  const status = data.data?.status || data.status
  const videoUrl = data.data?.generated?.[0]

  return {
    status: status === 'COMPLETED' ? 'completed' : status === 'FAILED' ? 'failed' : 'processing',
    videoUrl,
  }
}

export async function waitForLipSync(taskId: string, maxAttempts = 120): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getLipSyncResult(taskId)
    if (result.status === 'completed' && result.videoUrl) return result.videoUrl
    if (result.status === 'failed') throw new Error('Lip sync falhou')
    await new Promise(r => setTimeout(r, 5000))
  }
  throw new Error('Timeout: lip sync não ficou pronto')
}

// ===== POLLING =====

export async function waitForImage(taskId: string, model: string = 'flux-2-pro', maxAttempts = 60): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getImageResult(taskId, model)
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
