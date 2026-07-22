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
        <Navbar />
        {children}
      </body>
    </html>
  )
}
