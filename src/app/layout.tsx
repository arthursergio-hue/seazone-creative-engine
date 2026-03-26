import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Seazone Creative Engine',
  description: 'Máquina autônoma de criação de conteúdo para marketing - Seazone',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
