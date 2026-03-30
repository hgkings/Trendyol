'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Shield, TrendingUp, TrendingDown, Percent, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// ─── Animated Counter ───
function AnimatedNumber({ value, duration = 2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span ref={nodeRef}>{display.toLocaleString('tr-TR')}</span>;
}

// ─── Animated Progress Ring ───
function ProgressRing({ percent, size = 64, stroke = 5 }: { percent: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          stroke="url(#ring-gradient)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (percent / 100) * circumference }}
          transition={{ duration: 2, delay: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          className="text-sm font-bold text-emerald-400"
        >
          %{percent}
        </motion.span>
      </div>
    </div>
  );
}

// ─── Pulse Dot ───
function PulseDot({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className="relative flex h-2.5 w-2.5"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: color }} />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </motion.div>
  );
}

export function Hero() {
  const { user } = useAuth();

  // Cost data for animated bars
  const costs = [
    { label: 'Ürün', pct: 42, color: '#D97706' },
    { label: 'Komisyon', pct: 27, color: '#F59E0B' },
    { label: 'KDV', pct: 19, color: '#10B981' },
    { label: 'Kargo', pct: 12, color: '#6366F1' },
  ];

  return (
    <section className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-32 hero-gradient">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.12), transparent 70%)' }}
        />
        <div className="absolute top-1/3 right-0 h-[300px] w-[300px] rounded-full bg-amber-500/8 blur-[80px]" />
        <div className="absolute bottom-0 left-0 h-[200px] w-[400px] rounded-full bg-amber-600/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr,420px] lg:items-center">

          {/* ═══ SOL: İçerik ═══ */}
          <div className="max-w-2xl text-center lg:text-left mx-auto lg:mx-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs font-semibold"
              style={{ background: 'rgba(217,119,6,0.12)', color: '#FBBF24' }}
            >
              <PulseDot color="#F59E0B" />
              Yeni: Trendyol & Hepsiburada API Entegrasyonu
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1] mb-6 text-foreground"
              style={{ letterSpacing: '-0.5px' }}
            >
              Satıyorsun ama{' '}
              <span style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                kazanıyor musun?
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-8 text-lg text-[rgba(255,255,255,0.5)] leading-relaxed max-w-xl mx-auto lg:mx-0"
            >
              Pazaryeri komisyonları, kargo maliyetleri, iade kayıpları... Hepsini görünür kıl, kontrolü ele al.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6"
            >
              <Link href={user ? '/dashboard' : '/auth'}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-amber-500/30 btn-shine transition-all duration-300 gap-2 text-white hover:shadow-xl hover:-translate-y-[1px]"
                  style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                >
                  Ücretsiz Başla <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg"
                  className="w-full sm:w-auto h-12 px-8 text-base font-medium rounded-xl gap-2 transition-all duration-300 border-[rgba(255,255,255,0.06)] hover:bg-white/5"
                >
                  <Play className="h-4 w-4 fill-current" /> Nasıl Çalışır?
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-[rgba(255,255,255,0.5)]"
            >
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Kredi kartı gerekmez</span>
              <span className="flex items-center gap-1.5">👥 5.000+ satıcı</span>
              <span className="flex items-center gap-1.5">⭐ Ücretsiz plan sonsuza kadar</span>
            </motion.div>
          </div>

          {/* ═══ SAĞ: Premium Analiz Kartı ═══ */}
          <div className="hidden lg:block relative">

            {/* ── Kart Glow ── */}
            <div className="absolute -inset-4 rounded-3xl opacity-40 blur-2xl"
              style={{ background: 'radial-gradient(ellipse at center, rgba(217,119,6,0.15), transparent 70%)' }}
            />

            <motion.div
              initial={{ opacity: 0, y: 40, rotateX: 8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
              style={{ perspective: '1000px' }}
            >

              {/* ── Ana Kart ── */}
              <div className="relative rounded-3xl overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(12,10,9,0.95) 0%, rgba(6,6,8,0.98) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 25px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset',
                }}
              >
                {/* Üst gradient line */}
                <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 10%, #D97706 30%, #F59E0B 50%, #D97706 70%, transparent 90%)' }} />

                {/* Status bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="text-[10px] text-white/20 font-mono">karnet.com/analysis</span>
                  </div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-semibold text-emerald-400">Canlı</span>
                  </motion.div>
                </div>

                <div className="p-5 space-y-5">

                  {/* Ürün Header */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="flex items-start justify-between"
                  >
                    <div>
                      <h3 className="text-base font-bold text-white">Bluetooth Kulaklık TWS</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 font-medium">Trendyol</span>
                        <span className="text-[9px] text-white/20">·</span>
                        <span className="text-[9px] text-white/30">Elektronik</span>
                      </div>
                    </div>
                    <ProgressRing percent={17.8} size={56} stroke={4} />
                  </motion.div>

                  {/* 4 Mini Metrikler */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                    className="grid grid-cols-4 gap-2"
                  >
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p className="text-[7px] text-white/25 uppercase tracking-wider font-bold mb-1">Satış</p>
                      <p className="text-[13px] font-bold text-white tabular-nums"><AnimatedNumber value={349} /> <span className="text-[9px] text-white/30">TL</span></p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p className="text-[7px] text-white/25 uppercase tracking-wider font-bold mb-1">Maliyet</p>
                      <p className="text-[13px] font-bold text-white tabular-nums"><AnimatedNumber value={287} /> <span className="text-[9px] text-white/30">TL</span></p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                      <p className="text-[7px] text-emerald-400/50 uppercase tracking-wider font-bold mb-1">Kâr</p>
                      <p className="text-[13px] font-bold text-emerald-400 tabular-nums">+<AnimatedNumber value={62} /> <span className="text-[9px] text-emerald-400/50">TL</span></p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
                      <p className="text-[7px] text-amber-400/50 uppercase tracking-wider font-bold mb-1">Risk</p>
                      <div className="flex items-center justify-center gap-0.5">
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <p className="text-[11px] font-bold text-amber-400">Orta</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Maliyet Dağılımı - Animated Bars */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.5 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] text-white/30 uppercase tracking-wider font-bold">Maliyet Dağılımı</p>
                      <p className="text-[9px] text-white/20"><AnimatedNumber value={287} duration={2.5} /> TL toplam</p>
                    </div>

                    {costs.map((cost, i) => (
                      <div key={cost.label} className="flex items-center gap-2">
                        <span className="text-[9px] text-white/40 w-14 text-right shrink-0">{cost.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: `${cost.pct}%` }}
                            transition={{ duration: 1.2, delay: 1.0 + i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full"
                            style={{ background: cost.color }}
                          />
                        </div>
                        <span className="text-[9px] text-white/30 w-7 tabular-nums">%{cost.pct}</span>
                      </div>
                    ))}
                  </motion.div>

                  {/* Alt bölüm: Aylık projeksiyon */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.5, duration: 0.4 }}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02))', border: '1px solid rgba(217,119,6,0.12)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.15)' }}>
                        <TrendingUp className="h-4 w-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[8px] text-white/30 uppercase tracking-wider font-medium">Aylık Tahmini</p>
                        <p className="text-sm font-bold text-amber-400 tabular-nums">+<AnimatedNumber value={6200} duration={2.5} /> TL</p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowRight className="h-4 w-4 text-amber-400/50" />
                    </motion.div>
                  </motion.div>
                </div>

                {/* Alt gradient line */}
                <div className="h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.2), transparent)' }} />
              </div>


            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
