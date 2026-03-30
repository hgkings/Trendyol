'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KarnetLogo } from '@/components/shared/KarnetLogo';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { createClient } from '@/lib/supabase/client';
import {
  Eye, EyeOff, HelpCircle, ArrowRight, Check,
  TrendingUp, TestTube2, Plug,
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
  if (e.includes('email address not authorized') || e.includes('not authorized')) {
    return 'Bu e-posta adresi ile kayıt yapılamıyor.';
  }
  if (e.includes('smtp') || e.includes('email') && e.includes('send')) {
    return 'Doğrulama e-postası gönderilemedi. SMTP ayarlarını kontrol edin.';
  }
  // "Kayit hatasi: [gerçek mesaj]" — asıl hatayı göster
  if (e.includes('kayit hatasi')) {
    const actualError = err.replace(/^kayit hatasi:\s*/i, '');
    return `Kayıt başarısız: ${actualError}`;
  }
  return `Hata: ${err}`;
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

// ── Input ortak sınıflar ──
const inputClasses =
  'h-11 w-full rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 transition-all disabled:opacity-50';

const autofillStyle = { WebkitBoxShadow: '0 0 0 30px #0c0a09 inset', WebkitTextFillColor: 'white' };

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
  // Kayıt sonrası e-posta doğrulamasına yönlendirildiğinde user redirect'ini engelle
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);

  const { login, register, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = (() => {
    const next = searchParams.get('next') ?? '/dashboard';
    return (next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) ? next : '/dashboard';
  })();

  // Oturum açık kullanıcıyı yönlendir — render sırasında değil, effect içinde
  useEffect(() => {
    if (user && !awaitingEmailVerification) {
      router.replace(returnUrl);
    }
  }, [user, awaitingEmailVerification, router, returnUrl]);

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
          const supabase = createClient();
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            // TODO: replace with fetch('/api/user/profile') PATCH when API supports full_name
            await supabase.from('profiles').update({ full_name: trimmedName }).eq('id', authUser.id);
          }
        } catch {}

        // Email doğrulama geçici olarak devre dışı — direkt dashboard'a yönlendir
        router.push(returnUrl);
      } else {
        setError(translateError(result.error || ''));
      }
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    const supabase = createClient();
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
    1: 'text-red-400',
    2: 'text-amber-400',
    3: 'text-emerald-400',
  };

  return (
    <div className="flex h-screen bg-stone-950 text-white relative overflow-hidden">

      {/* ── LEFT PANEL — Auth form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 sm:px-10 py-10 relative z-10 overflow-y-auto">

        {/* Logo */}
        <div className="w-full max-w-[400px] mb-8">
          <KarnetLogo size={48} />
        </div>

        {/* Tab Switcher */}
        <div className="w-full max-w-[400px] mb-6">
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Kayıt Ol
            </button>
          </div>
        </div>

        {/* Form Content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-full max-w-[400px] space-y-6"
        >
          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white/90 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-stone-950 px-3 text-white/40">veya</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Ad Soyad — sadece kayıt modunda */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-white/70">Ad Soyad</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Adınız Soyadınız"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className={inputClasses}
                  autoComplete="name"
                  disabled={loading}
                  style={autofillStyle}
                />
              </div>
            )}

            {/* E-posta */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-white/70">E-posta</label>
              <input
                id="email"
                type="email"
                placeholder="ornek@sirket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClasses}
                autoComplete="email"
                disabled={loading}
                style={autofillStyle}
              />
            </div>

            {/* Şifre */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-white/70">Şifre</label>
                {mode === 'login' && (
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    Şifremi unuttum
                  </Link>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleCapsLockCheck}
                  onKeyUp={handleCapsLockCheck}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  className={`${inputClasses} pr-10`}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                  style={autofillStyle}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Caps Lock uyarısı */}
              {capsLockOn && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
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
                            : 'bg-white/10'
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
                <label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">Şifre Tekrar</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`${inputClasses} pr-10 ${
                      passwordsMismatch ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''
                    } ${
                      passwordsMatch ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/10' : ''
                    }`}
                    autoComplete="new-password"
                    disabled={loading}
                    style={autofillStyle}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
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
                  <p className="text-xs text-red-400">Şifreler eşleşmiyor.</p>
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
                  className="h-4 w-4 rounded border-white/20 accent-amber-600 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-sm text-white/50 cursor-pointer select-none">
                  Beni hatırla
                </label>
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
                  className="h-4 w-4 mt-0.5 rounded border-white/20 accent-amber-600 cursor-pointer shrink-0"
                />
                <label htmlFor="acceptTerms" className="text-sm text-white/50 cursor-pointer select-none leading-relaxed">
                  <Link href="/kullanim-sartlari" className="text-amber-500 hover:text-amber-400" target="_blank">Kullanım Şartları</Link>
                  {' '}ve{' '}
                  <Link href="/gizlilik-politikasi" className="text-amber-500 hover:text-amber-400" target="_blank">Gizlilik Politikası</Link>
                  &apos;nı okudum, kabul ediyorum.
                </label>
              </div>
            )}

            {/* Hata mesajı */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (mode === 'register' && !acceptTerms)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white text-sm font-semibold transition-all hover:shadow-lg hover:shadow-amber-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
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
            </button>
          </form>

          {/* Bottom Toggle */}
          <div className="text-center text-sm pt-2">
            {mode === 'login' ? (
              <p className="text-white/40">
                Hesabın yok mu?{' '}
                <button onClick={() => switchMode('register')} className="font-semibold text-amber-500 hover:text-amber-400 transition-colors">
                  Ücretsiz Başla
                </button>
              </p>
            ) : (
              <p className="text-white/40">
                Zaten üye misiniz?{' '}
                <button onClick={() => switchMode('login')} className="font-semibold text-amber-500 hover:text-amber-400 transition-colors">
                  Giriş Yap
                </button>
              </p>
            )}
          </div>
        </motion.div>

        {/* Mobile Stats */}
        <div className="md:hidden w-full max-w-[400px] mt-8 text-center space-y-4">
          <p className="text-sm text-white/40">Her satışında gerçek kârını bil.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-white/30">
            <span>5.000+ Satıcı</span>
            <span className="text-white/10">|</span>
            <span>1M+ Analiz</span>
            <span className="text-white/10">|</span>
            <span>%99.9 Uptime</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Branding (desktop only) ── */}
      <div className="hidden md:flex w-[50%] lg:w-[55%] relative flex-col justify-center px-10 lg:px-16 xl:px-20 py-12 overflow-hidden">

        {/* Grid Pattern */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(245,158,11,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.05) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Glow Orb */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(217,119,6,0.4) 0%, rgba(217,119,6,0) 70%)',
          }}
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-lg mx-auto space-y-10">

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              Kârını{' '}
              <span className="text-amber-400">kontrol altına al</span>
            </h1>
            <p className="mt-4 text-base lg:text-lg text-white/45 leading-relaxed max-w-md">
              Komisyon, kargo, iade — tüm gizli maliyetleri tek ekranda gör. Veriye dayalı kararlar al.
            </p>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid gap-4"
          >
            {[
              { icon: TrendingUp, title: 'Anlık Kâr Analizi', desc: 'Ürün bazlı net kâr, saniyeler içinde.' },
              { icon: TestTube2, title: 'Kampanya Simülatörü', desc: 'İndirimi uygulamadan önce test et.' },
              { icon: Plug, title: 'Pazaryeri Entegrasyonu', desc: 'Trendyol, Hepsiburada, n11, Amazon.' },
            ].map((card) => (
              <div key={card.title} className="flex items-start gap-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/15">
                  <card.icon className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/95">{card.title}</h3>
                  <p className="text-sm text-white/40 mt-0.5 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-3 gap-4"
          >
            {[
              { value: '5.000+', label: 'Aktif satıcı' },
              { value: '1M+', label: 'Analiz yapıldı' },
              { value: '%99.9', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl lg:text-2xl font-bold text-amber-400">{stat.value}</div>
                <div className="text-xs text-white/40 mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
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
