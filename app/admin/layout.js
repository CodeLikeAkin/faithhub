export const metadata = {
  title: 'FaithHub Admin',
  robots: { index: false, follow: false },
  // Replaces the member app's manifest on every /admin page, so "Install" here
  // installs the console, not FaithHub (app/admin/manifest.webmanifest).
  manifest: '/admin/manifest.webmanifest',
  applicationName: 'FaithHub Admin',
  appleWebApp: { capable: true, title: 'FH Admin', statusBarStyle: 'default' },
  icons: { icon: '/icons/admin-192.png', apple: '/icons/admin-apple-180.png' },
};

export const viewport = {
  themeColor: '#102A4E',
};

export default function AdminRootLayout({ children }) {
  return <div className="min-h-[100dvh] bg-[#F2F5FA] text-brand-ink">{children}</div>;
}
