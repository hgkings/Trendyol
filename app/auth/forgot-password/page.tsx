'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`;

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo,
    });

    if (resetError) {
      const msg = resetError.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('Çok fazla deneme yaptınız. Lütfen bekleyin.');
      } else {
        // User enumeration koruması: kayitli olsun olmasin ayni mesaj
        setSent(true);
      }
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, hsl(221 83% 53% / 0.06), transparent 60%), hsl(0 0% 99%)',
      }}
    >
      <div className="w-full max-w-[400px] space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img src="/brand/logo.svg" alt="Kârnet" className="h-8 w-auto mx-auto dark:hidden" />
          <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-8 w-auto mx-auto hidden dark:block" />
        </div>

        <div
          className="rounded-2xl bg-card border border-border/40 p-8 space-y-6"
          style={{
            boxShadow: '0 20px 60px hsl(221 83% 53% / 0.08)',
            border: '1px solid hsl(221 83% 53% / 0.1)',
          }}
        >
          {sent ? (
            /* ── Başarı durumu ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight font-geist">E-posta Gönderildi!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">{email}</span> adresine şifre sıfırlama
                  linki gönderdik. Spam kutunuzu da kontrol etmeyi unutmayın.
                </p>
              </div>
              <Link href="/auth">
                <Button variant="outline" className="w-full h-11 rounded-xl gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Giriş sayfasına dön
                </Button>
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight font-geist">Şifrenizi mi Unuttunuz?</h2>
                <p className="text-sm text-muted-foreground">
                  E-posta adresinizi girin, şifre sıfırlama linki gönderelim.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@sirket.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-lg"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold rounded-xl gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Gönderiliyor...
                    </>
                  ) : (
                    'Sıfırlama Linki Gönder'
                  )}
                </Button>
              </form>

              <div className="pt-2 text-center">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Giriş sayfasına dön
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
