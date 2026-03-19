'use client';

import { useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LiveAnalysisShowcase } from '@/components/auth/live-analysis-showcase';
import { Label } from '@/components/ui/label';
import {
  Eye, EyeOff, HelpCircle, BarChart3, ShieldAlert, Layers,
  Star, BadgeCheck, Zap, CreditCard, Lock as LockIcon, Users, ArrowRight, Check,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Hata mesajları: Supabase error → Türkçe ──
function translateError(err: string): string {
  const e = err.toLowerCase();
  if (e.includes('invalid login credentials') || e.includes('invalid credentials') || e.includes('giris hatasi')) {
    return 'E-posta veya şifre hatalı.';
  }
  if (e.includes('email not confirmed') || e.includes('email_not_confirmed')) {
    return 'E-postanızı doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.';
  }
  if (e.includes('too many requests') || e.includes('rate limit') || e.includes('over_email_send_rate_limit')) {
    return 'Çok fazla deneme yaptınız. Lütfen bekleyin.';
  }
  if (e.includes('user already registered') || e.includes('already registered')) {
    return 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.';
  }
  if (e.includes('password') && (e.includes('characters') || e.includes('karakter'))) {
    return 'Şifre en az 8 karakter olmalıdır.';
  }
  if (e.includes('kayit hatasi') || e.includes('kayıt hatası')) {
    return 'Kayıt başarısız. Lütfen tekrar deneyin.';
  }
  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

// ── Şifre güç hesaplayıcı ──
function getPasswordStrength(pwd: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (pwd.length === 0) return { level: 0, label: '' };
  if (pwd.length < 8) return { level: 1, label: 'Zayıf' };
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  if (pwd.length >= 12 && hasUpper && hasLower && hasNumber) return { level: 3, label: 'Güçlü' };
  return { level: 2, label: 'Orta' };
}

function AuthPageContent() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login, register, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = (() => {
    const next = searchParams.get('next') ?? '/dashboard';
    return (next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) ? next : '/dashboard';
  })();

  // ⚠️ Tüm hook'lar conditional return'dan ÖNCE tanımlanmalı (Rules of Hooks)
  const handleCapsLockCheck = useCallback((e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  }, []);

  const switchMode = useCallback((m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setAcceptTerms(false);
  }, []);

  if (user) {
    router.replace(returnUrl);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedEmail || !password) {
      setError('E-posta ve şifre gereklidir.');
      return;
    }

    if (mode === 'register') {
      if (!trimmedName) {
        setError('Ad Soyad alanı zorunludur.');
        return;
      }
      if (password.length < 8) {
        setError('Şifre en az 8 karakter olmalıdır.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Şifreler eşleşmiyor.');
        return;
      }
      if (!acceptTerms) {
        setError('Devam etmek için kullanım şartlarını kabul etmeniz gerekiyor.');
        return;
      }
    }

    setLoading(true);

    if (mode === 'login') {
      const result = await login(trimmedEmail, password);
      if (result.success) {
        router.push(returnUrl);
      } else {
        setError(translateError(result.error || ''));
      }
    } else {
      const result = await register(trimmedEmail, password);
      if (result.success) {
        // Profili full_name ile güncelle (hata olursa sessizce geç)
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            await supabase.from('profiles').update({ full_name: trimmedName }).eq('id', authUser.id);
          }
        } catch {}

        // Oturum açıldı mı yoksa email doğrulaması mı gerekiyor?
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push(returnUrl);
        } else {
          router.push(`/auth/verify-email?email=${encodeURIComponent(trimmedEmail)}`);
        }
      } else {
        setError(translateError(result.error || ''));
      }
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}` },
    });
    if (error) {
      console.error('[Google OAuth]', error.message);
      setError('Google ile giriş başarısız. Lütfen tekrar deneyin.');
      setGoogleLoading(false);
    }
  };

  const pwdStrength = mode === 'register' ? getPasswordStrength(password) : null;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const strengthColors: Record<1 | 2 | 3, string> = {
    1: 'bg-red-500',
    2: 'bg-amber-500',
    3: 'bg-emerald-500',
  };
  const strengthTextColors: Record<1 | 2 | 3, string> = {
    1: 'text-red-600 dark:text-red-400',
    2: 'text-amber-600 dark:text-amber-400',
    3: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden">

      {/* ── LEFT PANEL (desktop only) — dark gradient with product context ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-center px-10 xl:px-14 py-12 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(221 83% 20%) 0%, hsl(221 83% 35%) 50%, hsl(221 83% 28%) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        <div className="relative z-10 max-w-md mx-auto space-y-8">
          <div>
            <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-9 w-auto" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white leading-tight font-geist">
              Pazaryerinde gerçekten<br />
              <span className="text-orange-300">kâr ediyor musun?</span>
            </h1>
            <p className="text-white/70 leading-relaxed">
              Komisyon, kargo, reklam, iade, KDV dahil — net kâr ve risk puanı.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: BarChart3, text: 'Net kâr & kâr marjı', color: 'text-blue-300' },
              { icon: ShieldAlert, text: 'Zarar/risk uyarısı', color: 'text-amber-300' },
              { icon: Layers, text: 'Ürün bazlı maliyet dökümü', color: 'text-emerald-300' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-white/90">{item.text}</span>
              </div>
            ))}
          </div>

          <LiveAnalysisShowcase />

          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Yorumlar</span>
            <div className="grid gap-3">
              {[
                { quote: 'Zarar ettiğimi fark etmem 2 dakika sürdü.', name: 'Emre K.', role: 'Trendyol Satıcısı' },
                { quote: 'Excel\'den kurtuldum, her şey tek panelde.', name: 'Seda A.', role: 'E-ticaret Danışmanı' },
              ].map((t) => (
                <div key={t.name} className="rounded-xl bg-white/8 border border-white/10 p-3.5 space-y-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-white/80">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-white/90">{t.name}</span>
                    <span className="text-[10px] text-white/40">· {t.role}</span>
                    <BadgeCheck className="h-3 w-3 text-emerald-400 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-white/90">
              <span className="text-lg">🔒</span>
              <span className="text-sm font-medium">Kredi kartı gerekmez</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <span className="text-lg">👥</span>
              <span className="text-sm font-medium">500+ aktif satıcı kullanıyor</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <span className="text-lg">⭐</span>
              <span className="text-sm font-medium">Ücretsiz plan sonsuza kadar ücretsiz</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth form ── */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-12"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 100% 0%, hsl(221 83% 53% / 0.06), transparent 60%), hsl(0 0% 99%)',
        }}
      >

        {/* Mobile logo */}
        <div className="lg:hidden w-full max-w-[420px] mb-8 text-center space-y-3">
          <div className="flex justify-center">
            <img src="/brand/logo.svg" alt="Kârnet" className="h-9 w-auto dark:hidden" />
            <img src="/brand/logo-dark.svg" alt="Kârnet" className="h-9 w-auto hidden dark:block" />
          </div>
          <p className="text-sm text-muted-foreground">Net kârını gör. Komisyon, kargo, iade dahil.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px] space-y-5"
        >
          {/* Auth card */}
          <div
            className="rounded-2xl bg-card p-7 sm:p-8 relative overflow-hidden"
            style={{
              boxShadow: '0 20px 60px hsl(221 83% 53% / 0.08)',
              border: '1px solid hsl(221 83% 53% / 0.1)',
            }}
          >
            <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-7">
                <h2 className="text-2xl font-bold tracking-tight font-geist">
                  {mode === 'login' ? 'Hoş Geldiniz' : 'Hesap Oluştur'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === 'login'
                    ? 'Devam etmek için bilgilerinizi girin.'
                    : 'Kârnet ile kârlılığınızı artırmaya başlayın.'}
                </p>
              </div>

              {/* Google */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm font-medium rounded-xl gap-3 border-border hover:bg-muted/60 transition-all mb-1"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Google ile devam et
              </Button>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">veya e-posta ile devam et</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Ad Soyad — sadece kayıt modunda */}
                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">Ad Soyad</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Adınız Soyadınız"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-11 rounded-lg"
                      autoComplete="name"
                      disabled={loading}
                    />
                  </div>
                )}

                {/* E-posta */}
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

                {/* Şifre */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
                    {mode === 'login' && (
                      <Link
                        href="/auth/forgot-password"
                        className="text-xs text-primary hover:underline"
                      >
                        Şifremi unuttum
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleCapsLockCheck}
                      onKeyUp={handleCapsLockCheck}
                      required
                      minLength={mode === 'register' ? 8 : 1}
                      className="h-11 rounded-lg pr-10"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Caps Lock uyarısı */}
                  {capsLockOn && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ⚠️ Caps Lock açık
                    </p>
                  )}

                  {/* Şifre güç göstergesi — sadece kayıt modunda */}
                  {mode === 'register' && pwdStrength && pwdStrength.level > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <div className="flex gap-1">
                        {([1, 2, 3] as const).map((n) => (
                          <div
                            key={n}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              n <= pwdStrength.level
                                ? strengthColors[pwdStrength.level as 1 | 2 | 3]
                                : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${strengthTextColors[pwdStrength.level as 1 | 2 | 3]}`}>
                        {pwdStrength.label}
                        {pwdStrength.level === 1 && ' — 8+ karakter kullanın'}
                        {pwdStrength.level === 2 && ' — büyük/küçük harf ve rakam ekleyin'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Şifre tekrar — sadece kayıt modunda */}
                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Şifre Tekrar</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={`h-11 rounded-lg pr-10 ${
                          passwordsMismatch ? 'border-red-400 dark:border-red-500 focus-visible:ring-red-400' : ''
                        } ${
                          passwordsMatch ? 'border-emerald-400 dark:border-emerald-500 focus-visible:ring-emerald-400' : ''
                        }`}
                        autoComplete="new-password"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                      >
                        {passwordsMatch ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {passwordsMismatch && (
                      <p className="text-xs text-red-600 dark:text-red-400">Şifreler eşleşmiyor.</p>
                    )}
                  </div>
                )}

                {/* Beni hatırla — sadece giriş modunda */}
                {mode === 'login' && (
                  <div className="flex items-center gap-2">
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                      Beni hatırla
                    </Label>
                  </div>
                )}

                {/* Kullanım şartları — sadece kayıt modunda */}
                {mode === 'register' && (
                  <div className="flex items-start gap-2">
                    <input
                      id="acceptTerms"
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-border accent-primary cursor-pointer shrink-0"
                    />
                    <Label htmlFor="acceptTerms" className="text-sm text-muted-foreground cursor-pointer select-none leading-relaxed">
                      <Link href="/kullanim-sartlari" className="text-primary hover:underline" target="_blank">Kullanım Şartları</Link>
                      {' '}ve{' '}
                      <Link href="/gizlilik-politikasi" className="text-primary hover:underline" target="_blank">Gizlilik Politikası</Link>
                      &apos;nı okudum, kabul ediyorum.
                    </Label>
                  </div>
                )}

                {/* Hata mesajı */}
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
                    <HelpCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold rounded-xl btn-shine shadow-sm transition-all gap-2"
                  disabled={loading || (mode === 'register' && !acceptTerms)}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {mode === 'login' ? 'Giriş Yapılıyor...' : 'Hesap Oluşturuluyor...'}
                    </>
                  ) : (
                    <>
                      {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Toggle */}
              <div className="mt-6 pt-5 border-t border-border/50 text-center text-sm">
                {mode === 'login' ? (
                  <p className="text-muted-foreground">
                    Hesabınız yok mu?{' '}
                    <button onClick={() => switchMode('register')} className="font-semibold text-primary hover:underline">
                      Ücretsiz Kayıt Ol
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Zaten üye misiniz?{' '}
                    <button onClick={() => switchMode('login')} className="font-semibold text-primary hover:underline">
                      Giriş Yap
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Demo link */}
          <div className="text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
            >
              <Zap className="h-4 w-4" />
              Hesap oluşturmadan demo&apos;yu dene →
            </Link>
          </div>

          {/* Mobile context */}
          <div className="lg:hidden w-full space-y-4">
            <LiveAnalysisShowcase />
            <div className="rounded-lg border bg-card/60 p-3.5 space-y-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs leading-relaxed text-foreground/90">&ldquo;Zarar ettiğimi fark etmem 2 dakika sürdü.&rdquo;</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold">Emre K.</span>
                <span className="text-[10px] text-muted-foreground">· Trendyol Satıcısı</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Kredi kartı gerekmez</span>
              <span>·</span>
              <span className="flex items-center gap-1"><LockIcon className="h-3 w-3" /> Veriler satılmaz</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 500+ satıcı</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
