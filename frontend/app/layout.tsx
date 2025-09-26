import './globals.css'

export const metadata = {
  title: 'ACM - Análisis Comparativo de Mercado',
  description: 'ACM frontend'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
