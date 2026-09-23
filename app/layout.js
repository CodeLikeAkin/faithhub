import './globals.css'
import { Roboto, Newsreader } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Navbar from '@/components/Navbar'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  // Next has no fallback metrics for Newsreader, so it can't build a
  // size-adjusted local fallback and warns on every build. Asking for the
  // plain serif fallback instead silences it and changes nothing on screen.
  adjustFontFallback: false,
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

export const metadata = {
  title: 'FaithHub — Heritage of Faith Church',
  description:
    "Study Rev. Peter Ayo Alabi's teaching and speak God's Word over your life. Declarations, series study, and scripture — grounded in the messages of Heritage of Faith Church.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${roboto.variable} ${newsreader.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-brand-navy focus:font-bold focus:text-sm focus:rounded-full focus:border focus:border-brand-navy focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Navbar />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
