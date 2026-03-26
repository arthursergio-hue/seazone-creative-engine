import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { convertTo916 } from '@/lib/image-process'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Salvar original
    const uploadDir = join('/tmp', 'uploads', category)
    await mkdir(uploadDir, { recursive: true })
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    const originalUrl = `/api/uploads?category=${category}&file=${filename}`

    // Converter para 9:16 automaticamente
    let processedUrl: string
    try {
      processedUrl = await convertTo916(buffer, filename)
    } catch {
      processedUrl = originalUrl // fallback para original se conversão falhar
    }

    return NextResponse.json({
      url: processedUrl,         // URL da imagem processada (9:16)
      originalUrl,               // URL original
      filename,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro no upload' },
      { status: 500 }
    )
  }
}
