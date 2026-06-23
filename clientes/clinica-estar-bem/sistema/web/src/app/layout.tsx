import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Núcleo Estar Bem',
  description: 'Sistema de gestão de salas',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
