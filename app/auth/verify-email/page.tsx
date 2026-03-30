// TODO: Email doğrulama aktif edilecek
// Supabase'de "Confirm email" açılınca
// kayıt akışı tekrar verify-email'e
// yönlendirilmeli

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { KarnetLogo } from '@/components/shared/KarnetLogo';
import { Mail } from 'lucide-react';

const RESEND_COOLDOWN = 60;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0 || !email) return;
    setResendLoading(true);
    setResendError('');
    setResendSuccess(false);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setResendError('Çok fazla istek. Lütfen birkaç dakika bekleyin.');
      } else {
        setResendError('E-posta gönderilemedi. Lütfen tekrar deneyin.');
      }
    } else {
      setResendSuccess(true);
      setCountdown(RESEND_COOLDOWN);
    }

    setResendLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-12 text-white">
      <div className="w-full max-w-[420px] space-y-8">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <KarnetLogo size={40} />
          <span className="text-lg font-bold tracking-tight">Kârnet</span>
        </div>

        {/* Kart */}
        <div className="rounded-2xl border border-white/8 bg-white/5 p-10 space-y-6 text-center"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}
        >
          {/* Mail ikonu */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
              <Mail className="h-8 w-8 text-indigo-400" />
            </div>
          </div>

          {/* Başlık */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              E-postanızı Doğrulayın
            </h1>

            {/* Açıklama */}
            <div className="text-sm leading-relaxed text-white/60 space-y-1">
              {email && (
                <p className="font-semibold text-indigo-400 text-base">{email}</p>
              )}
              <p>
                {email
                  ? 'adresine doğrulama linki gönderdik. Linke tıklayarak hesabınızı aktifleştirin.'
                  : 'Kayıt sırasında verdiğiniz e-posta adresine doğrulama linki gönderdik.'}
              </p>
            </div>

            <p className="text-xs text-white/35">
              Gelen kutunuzda göremiyorsanız spam klasörünü kontrol edin.
            </p>
          </div>

          {/* Geri bildirim */}
          {resendSuccess && (
            <p className="text-sm font-medium text-emerald-400">
              ✓ Doğrulama e-postası tekrar gönderildi.
            </p>
          )}
          {resendError && (
            <p className="text-sm text-red-400">{resendError}</p>
          )}

          {/* Tekrar gönder butonu */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || countdown > 0}
            className={`w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              countdown > 0 || resendLoading
                ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5'
            }`}
          >
            {resendLoading ? (
              <>
                <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Gönderiliyor...
              </>
            ) : countdown > 0 ? (
              `Tekrar Gönder (${countdown}s)`
            ) : (
              'Tekrar Gönder'
            )}
          </button>

          {/* Ayraç */}
          <div className="border-t border-white/8" />

          {/* Alt link */}
          <Link
            href="/auth"
            className="block text-sm text-white/35 hover:text-white/60 underline underline-offset-4 transition-colors"
          >
            Farklı e-posta ile kayıt ol
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
