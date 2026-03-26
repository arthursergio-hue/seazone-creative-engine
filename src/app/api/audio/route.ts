import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get('file')
  if (!filename) {
    return NextResponse.json({ error: 'Arquivo não especificado' }, { status: 400 })
  }

  try {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filepath = join('/tmp', 'audio', safeName)
    const buffer = await readFile(filepath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `inline; filename="${safeName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
  }
}
