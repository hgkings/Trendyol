'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const router = useRouter();

  if (user) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('E-posta ve şifre gereklidir.');
      setLoading(false);
      return;
    }

    const result = mode === 'login'
      ? await login(trimmedEmail, password)
      : await register(trimmedEmail, password);

    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || 'Bir hata oluştu.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Visual Panel */}
      <div className="hidden w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-premium-md">
            <TrendingUp className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Kar Koçu</h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Pazaryerinde gerçekten kâr ediyor musun? Tüm giderlerini hesapla, gerçek net kârını gör.
          </p>
          <div className="mt-8 rounded-2xl border bg-card/60 p-6 text-left backdrop-blur shadow-premium-sm">
            <p className="text-sm font-semibold text-foreground">Demo Hesap</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>E-posta: demo@demo.com</p>
              <p>Şifre: 123456</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          {/* Mobile Logo */}
          <div className="mb-8 text-center lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Kar Koçu</span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Pazaryeri kâr analiz aracı
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border bg-card p-8 shadow-premium-md">
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Hesabınıza giriş yaparak devam edin.'
                : 'Yeni bir hesap oluşturun.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 rounded-xl px-4 text-[15px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="En az 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 rounded-xl px-4 pr-12 text-[15px]"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-premium-sm" disabled={loading}>
                {loading ? 'Yükleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-muted-foreground">
                  Hesabınız yok mu?{' '}
                  <button
                    className="font-semibold text-primary hover:underline"
                    onClick={() => { setMode('register'); setError(''); }}
                  >
                    Kayıt Ol
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Zaten hesabınız var mı?{' '}
                  <button
                    className="font-semibold text-primary hover:underline"
                    onClick={() => { setMode('login'); setError(''); }}
                  >
                    Giriş Yap
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Mobile Demo */}
          <div className="mt-6 rounded-xl border bg-muted/50 p-4 text-center lg:hidden">
            <p className="text-xs font-medium text-muted-foreground">Demo Hesap</p>
            <p className="mt-1 text-xs text-muted-foreground">demo@demo.com / 123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}
