'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart2, Play } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { motion } from 'framer-motion';

export function CTASection() {
  const { user } = useAuth();

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl px-6 py-16 sm:px-12 sm:py-20 text-center shadow-premium-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(146,64,14,0.05))',
            border: '1px solid rgba(217,119,6,0.15)',
          }}
        >
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Glow blobs */}
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-600/10 blur-3xl" />

          {/* Corner chart icon decoration */}
          <div className="absolute bottom-4 right-6 opacity-[0.05] pointer-events-none select-none">
            <BarChart2 className="h-40 w-40 text-amber-700 dark:text-amber-400" />
          </div>

          <div className="relative z-10">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold mb-6 backdrop-blur-sm bg-amber-500/12 text-amber-800 dark:text-amber-300"
            >
              Hemen Başla
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-foreground mb-4" style={{ letterSpacing: '-0.5px' }}>
              2 dakikada gerçek{' '}
              <span style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                kârını
              </span>{' '}öğren
            </h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-10">
              Ücretsiz plan ile hemen başla. Kurulum yok, kart bilgisi yok.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={user ? '/analysis/new' : '/auth'}>
                <Button
                  size="lg"
                  className="h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-amber-500/30 text-white hover:shadow-xl hover:-translate-y-[1px] transition-all duration-200 gap-2"
                  style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
                >
                  Ücretsiz Başla
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth?tab=demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base font-medium rounded-xl border-border/40 hover:bg-muted/50 transition-all duration-200 gap-2"
                >
                  <Play className="h-4 w-4" />
                  Demo İzle
                </Button>
              </Link>
            </div>

            {/* Trust icons */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <span>🔒 Güvenli ödeme</span>
              <span>📊 Anlık analiz</span>
              <span>🔐 Veriler şifreli</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
