import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

/**
 * Converte qualquer imagem para formato 9:16 (vertical).
 * - Se a imagem é vertical (9:16 ou similar): apenas redimensiona
 * - Se a imagem é horizontal (16:9 ou similar): cria um crop inteligente
 *   que pega a parte central da imagem em formato vertical
 *
 * Retorna a URL da imagem processada via API route.
 */
export async function convertTo916(imageBuffer: Buffer, filename: string): Promise<string> {
  const outputDir = join('/tmp', 'processed')
  await mkdir(outputDir, { recursive: true })

  const safeName = `916_${filename}`
  const outputPath = join(outputDir, safeName)

  const metadata = await sharp(imageBuffer).metadata()
  const width = metadata.width || 1080
  const height = metadata.height || 1920

  const targetWidth = 1080
  const targetHeight = 1920
  const targetRatio = 9 / 16 // 0.5625

  const currentRatio = width / height

  let processed: sharp.Sharp

  if (currentRatio > targetRatio) {
    // Imagem é mais larga que 9:16 (horizontal/landscape)
    // Crop central na largura para encaixar em 9:16
    const newWidth = Math.round(height * targetRatio)
    const left = Math.round((width - newWidth) / 2)

    processed = sharp(imageBuffer)
      .extract({ left, top: 0, width: newWidth, height })
      .resize(targetWidth, targetHeight, { fit: 'fill' })
  } else {
    // Imagem já é vertical ou quadrada — apenas redimensiona
    processed = sharp(imageBuffer)
      .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
  }

  await processed.jpeg({ quality: 90 }).toFile(outputPath)

  return `/api/processed?file=${safeName}`
}
