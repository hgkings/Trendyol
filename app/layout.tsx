import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/contexts/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { AlertProvider } from '@/contexts/alert-context';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kârnet - Pazaryeri Kâr Hesaplama Aracı',
  description: 'Pazaryerinde gerçekten kâr ediyor musun? Komisyon, KDV, iade, reklam dahil gerçek net kârını gör.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
      </body>
    </html>
  );
}
