export const metadata = {
  title: 'FaithHub Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }) {
  return <div className="min-h-[100dvh] bg-[#F2F5FA] text-brand-ink">{children}</div>;
}
