'use client';

import Link from 'next/link';
import { Mail, MapPin, User, ShieldCheck } from 'lucide-react';
import { KarnetLogo } from '@/components/shared/KarnetLogo';

const PRODUCT_LINKS = [
  { href: '/pricing', label: 'Fiyatlandırma' },
  { href: '/demo', label: 'Demo' },
  { href: '/auth', label: 'Giriş Yap' },
  { href: '/support', label: 'Destek' },
  { href: '/hakkimizda', label: 'Hakkımızda' },
];

const LEGAL_LINKS = [
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/kullanim-sartlari', label: 'Kullanım Şartları' },
  { href: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satış' },
  { href: '/iade-politikasi', label: 'İade Politikası' },
];

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <KarnetLogo size={32} className="mb-3" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pazaryeri satıcılarının gerçek kârını görmesini sağlayan analiz platformu.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>PayTR güvencesiyle ödeme</span>
            </div>
          </div>

          {/* Ürün */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Ürün</h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors animated-underline inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Yasal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Yasal</h4>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors animated-underline inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* İletişim */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">İletişim</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-amber-500/70" />
                <a href="mailto:karnet.destek@gmail.com" className="hover:text-foreground transition-colors">
                  karnet.destek@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-amber-500/70 mt-0.5" />
                <span className="leading-relaxed">
                  Konya, Türkiye
                </span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <User className="h-4 w-4 shrink-0 text-amber-500/70" />
                <span>Süleyman Hilmi İşbilir</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Kârnet · PayTR güvencesiyle · Veriler satılmaz
          </p>
          <p className="text-xs text-muted-foreground/60">
            Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
