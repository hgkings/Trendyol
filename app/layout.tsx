import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { ThemeProvider } from '@/contexts/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { AlertProvider } from '@/contexts/alert-context';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { CookieConsent } from '@/components/shared/cookie-consent';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'Kârnet',
    template: '%s | Kârnet',
  },
  description: 'Ürün portföyünüzün anlık kârlılık ve risk durumu.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: 'https://karnet.com',
    title: 'Kârnet',
    description: 'Ürün portföyünüzün anlık kârlılık ve risk durumu.',
    siteName: 'Kârnet',
    images: [
      {
        url: '/brand/og.png',
        width: 1200,
        height: 630,
        alt: 'Kârnet Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kârnet',
    description: 'Ürün portföyünüzün anlık kârlılık ve risk durumu.',
    images: ['/brand/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} ${GeistSans.variable} font-sans`}>
        {/* Aurora animated background — all pages */}
        <div className="aurora-bg">
          <div className="aurora-orb orb-1" />
          <div className="aurora-orb orb-2" />
          <div className="aurora-orb orb-3" />
        </div>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <AlertProvider>
              {children}
            </AlertProvider>
            <Toaster
              richColors
              position="top-right"
              style={{ pointerEvents: 'none' }} // Container shouldn't capture clicks
              toastOptions={{
                style: { pointerEvents: 'auto' }, // Toast content should be clickable
              }}
            />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
