import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TRUSTLab Vote',
  description: 'Created by Volodymyr Dubetskyy at TRUSTLab',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
