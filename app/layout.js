import './globals.css'
import { Roboto, Newsreader } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Navbar from '@/components/Navbar'
import PlayerProvider from '@/components/player/PlayerProvider'
import PwaRoot from '@/components/pwa/PwaRoot'
import { INSTALL_CAPTURE_SCRIPT } from '@/lib/pwa'
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from '@/lib/site'

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
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Opened from the iOS home screen: full screen, "FaithHub" under the icon,
  // a plain status bar. The icon is app/apple-icon.png; the rest of the
  // installable app is app/manifest.js + public/sw.js.
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
}

// Next 14 takes the theme colour here, not in `metadata`.
export const viewport = {
  themeColor: THEME_COLOR,
}

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: browser extensions routinely add attributes to
    // <html> before React hydrates, which React would otherwise flag.
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Catches Chrome's install prompt before hydration (lib/pwa.js). */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
      </head>
      <body className={`${roboto.variable} ${newsreader.variable} font-sans antialiased`}>
        {/* The brand splash is parked for launch — the navy-background version
            didn't read right. Nothing is deleted: the markup lives in
            components/splash/, the animation in globals.css ("Splash screen").
            To bring it back, re-import SplashScreen and SPLASH_SCRIPT, render
            <SplashScreen /> here, and put SPLASH_SCRIPT back in a <head> script
            (it must run before the body paints, or a repeat visit flashes it). */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-brand-navy focus:font-bold focus:text-sm focus:rounded-full focus:border focus:border-brand-navy focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Navbar />
        {/* The one video player lives here, above every page, so a video
            keeps playing (shrunk to the corner) when you move around the app. */}
        <PlayerProvider>{children}</PlayerProvider>
        <PwaRoot />
        <Analytics />
      </body>
    </html>
  )
}
