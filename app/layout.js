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

// Set the theme before first paint so there's no light-mode flash on load.
// Reads the saved choice, falling back to the OS preference.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${roboto.variable} font-sans antialiased`}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
