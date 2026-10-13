import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'

/** Inter matches the reference dashboard’s geometric UI sans. Lucide pairs with it. */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'DealFit · SaaSquatch add-on',
  description:
    'ETA deal sourcing on SaaSquatch exports: fit scoring, owner and succession signals, automated outreach, CRM handoff.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  )
}
