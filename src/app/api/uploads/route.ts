import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') || 'general'
  const filename = req.nextUrl.searchParams.get('file')

  if (!filename) {
    return NextResponse.json({ error: 'Arquivo não especificado' }, { status: 400 })
  }

  try {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filepath = join('/tmp', 'uploads', safeCategory, safeName)
    const buffer = await readFile(filepath)

    const ext = safeName.split('.').pop()?.toLowerCase()
    const contentTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }
}
