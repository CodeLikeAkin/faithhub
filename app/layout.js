import './globals.css'
import { Roboto } from 'next/font/google'
import Navbar from '@/components/Navbar'

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto',
})

export const metadata = {
  title: 'FaithHub — Heritage of Faith Church',
  description:
    "Study Rev. Peter Ayo Alabi's teaching and speak God's Word over your life. Declarations, series study, and scripture — grounded in the messages of Heritage of Faith Church.",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${roboto.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-brand-navy focus:font-bold focus:text-sm focus:rounded-full focus:border focus:border-brand-navy focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
