'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

const benefits = [
  'Pazaryeri komisyonu',
  'KDV hesaplaması',
  'İade kaybı tahmini',
  'Reklam maliyeti',
  'Kargo ücreti',
  'Paketleme maliyeti',
  'Diğer giderler',
  'Başa baş noktası analizi',
  'Nakit akışı tahmini',
  'Rakip fiyat analizi (Yakında)',
  'Stok maliyet hesabı',
  'Döviz kuru etkisi',
];

export function BenefitsList() {
  return (
    <section className="py-24 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="inline-block mb-3 rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-500/12 text-amber-800 dark:text-amber-300">
            Kapsam
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl mb-4" style={{ letterSpacing: '-0.5px' }}>
            Hesaplama Neleri{' '}
            <span style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              İçeriyor?
            </span>
          </h2>
          <p className="text-base text-muted-foreground">
            Tüm e-ticaret giderlerinizi tek panelde görün.
          </p>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {benefits.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 hover:border-amber-500/20 hover:bg-muted/30 transition-all duration-200"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span className="text-sm font-medium">{item}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
