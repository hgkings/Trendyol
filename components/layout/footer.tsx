'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin, User } from 'lucide-react';

const LEGAL_LINKS = [
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/iletisim', label: 'İletişim' },
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satış Sözleşmesi' },
  { href: '/iade-politikasi', label: 'İade Politikası' },
  { href: '/kullanim-sartlari', label: 'Kullanım Şartları' },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src="/brand/logo.svg" alt="Kârnet" className="h-8 w-auto dark:hidden" />
              <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-8 w-auto hidden dark:block" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              İşletmelerin satışlarını ve kârlarını kolay takip edebilmesi için geliştirilen yazılım platformu.
            </p>
          </div>

          {/* Yasal */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Yasal</h4>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hızlı Linkler */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Hızlı Linkler</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Fiyatlandırma
                </Link>
              </li>
              <li>
                <Link href="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Giriş Yap
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Destek
                </Link>
              </li>
            </ul>
          </div>

          {/* İletişim */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">İletişim</h4>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary/70" />
                <a href="mailto:destek@karnet.com" className="hover:text-foreground transition-colors">destek@karnet.com</a>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary/70" />
                <span>+90 5XX XXX XX XX</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                <span>Konya / Türkiye</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4 shrink-0 text-primary/70" />
                <span>Süleyman Hilmi İşbilir</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Kârnet. Tüm hakları saklıdır.
          </p>
          <p className="text-xs text-muted-foreground">
            Güvenli ödeme altyapısı ile hizmet verilmektedir.
          </p>
        </div>
      </div>
    </footer>
  );
}
