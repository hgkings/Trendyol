'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'karnet_cookie_consent';

type ConsentValue = 'accepted' | 'rejected' | null;

function getConsent(): ConsentValue {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === 'accepted' || value === 'rejected') return value;
  return null;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Consent daha once verilmisse gosterme
    const consent = getConsent();
    if (!consent) {
      // Kisa gecikme — sayfa yuklenince gostersin
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border/50 bg-background p-5 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Sitemizde oturum yonetimi icin zorunlu cerezler kullanilmaktadir.
              Analitik cerezler ise onayinizla aktif edilir.{' '}
              <Link
                href="/cerez-politikasi"
                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 underline underline-offset-2"
              >
                Cerez Politikasi
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReject}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground/90 border border-border/60 hover:border-border transition-all"
            >
              Reddet
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-all hover:-translate-y-[1px] hover:shadow-lg hover:shadow-amber-500/20"
              style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
            >
              Kabul Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
