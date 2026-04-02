'use client';

import { motion } from 'framer-motion';
import { Calculator, Shield, BarChart3, Target, FileSpreadsheet, TrendingUp, Crown, Calendar } from 'lucide-react';

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: 'easeOut' },
  }),
};

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block mb-3 rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-500/12 text-amber-800 dark:text-amber-300">
            Özellikler
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl mb-4" style={{ letterSpacing: '-0.5px' }}>
            Neden{' '}
            <span style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Kârnet?
            </span>
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Basit bir kâr hesabından çok daha fazlası.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">

          {/* Large card — col span 2 */}
          <motion.div
            custom={0} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="lg:col-span-2 group relative rounded-2xl border border-border/40 bg-card p-6 hover:border-amber-500/30 hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400 transition-colors">
                <Calculator className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-2">Ürün Bazlı Kâr Analizi</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-1">
                &quot;Bu ürün beni kâra mı zarara mı sokuyor?&quot; Artık tahmin etme, hesapla.
              </p>
              <p className="text-muted-foreground/60 text-xs mb-4">4 pazaryerinde tüm maliyetler dahil net kâr</p>
              <div className="rounded-xl bg-muted/20 border border-border/40 p-4 flex items-end gap-1.5 h-20">
                {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all duration-300"
                    style={{ height: `${h}%`, background: 'linear-gradient(to top, rgba(217,119,6,0.6), rgba(217,119,6,0.2))' }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Risk Analysis */}
          <motion.div
            custom={1} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="group relative rounded-2xl border border-border/40 bg-card p-6 hover:border-red-500/30 hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/5 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/8 border border-red-500/12 text-red-400 transition-colors">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Risk Analizi</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                Ürün bazında risk puanı ve zarar uyarıları.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Yüksek Risk', color: 'bg-red-500/12 text-red-400', barColor: 'bg-red-500/40', w: '60%' },
                  { label: 'Orta Risk', color: 'bg-amber-500/12 text-amber-700 dark:text-amber-400', barColor: 'bg-amber-500/40', w: '35%' },
                  { label: 'Düşük Risk', color: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400', barColor: 'bg-emerald-500/40', w: '5%' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className="h-2 rounded-full bg-muted/20 flex-1 overflow-hidden">
                      <div className={`h-full rounded-full ${r.barColor}`} style={{ width: r.w }} />
                    </div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${r.color}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Sensitivity */}
          <motion.div
            custom={2} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="group relative rounded-2xl border border-border/40 bg-card p-6 hover:border-amber-500/30 hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400 transition-colors">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Önce Test Et, Sonra Uygula</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-1">
                İndirim, kampanya, fiyat değişikliği... Uygulamadan önce kâr etkisini hesapla.
              </p>
              <p className="text-muted-foreground/60 text-xs mb-3">Riski almadan sonucu gör</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Fiyat</span><span className="font-semibold text-foreground">₺349</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted/20 overflow-hidden">
                  <div className="absolute left-0 h-full w-[70%] rounded-full" style={{ background: 'linear-gradient(to right, #D97706, rgba(217,119,6,0.4))' }} />
                  <div className="absolute top-1/2 left-[70%] -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-amber-500 border-2 border-background shadow-sm" />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>₺200</span><span>₺500</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 4 Marketplaces */}
          <motion.div
            custom={3} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="group relative rounded-2xl border border-border/40 bg-card p-6 hover:border-amber-500/30 hover:shadow-lg transition-all duration-300"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400 transition-colors">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold mb-2">Finansal Takvim</h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-1">
              Hangi gün ne kadar para girecek, ne kadar çıkacak?
            </p>
            <p className="text-muted-foreground/60 text-xs">Pazaryeri ödeme takvimi ve giderler tek ekranda</p>
          </motion.div>

          {/* KDV — Pro */}
          <motion.div
            custom={4} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="group relative rounded-2xl border border-amber-500/15 bg-[rgba(217,119,6,0.03)] p-6 hover:border-amber-500/30 hover:shadow-lg transition-all duration-300"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400 transition-colors">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              KDV Ayrıştırma
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-400">
                <Crown className="h-2.5 w-2.5" /> PRO
              </span>
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Muhasebe modunda KDV dahil/hariç hesaplama ve fatura bazlı analiz.
            </p>
          </motion.div>

          {/* Marketplace comparison — large */}
          <motion.div
            custom={5} initial="hidden" whileInView="visible" variants={fadeUp} viewport={{ once: true }}
            className="lg:col-span-2 group relative rounded-2xl border border-border/40 bg-card p-6 hover:border-emerald-500/30 hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent" />
            <div className="relative">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/8 border border-emerald-500/12 text-emerald-700 dark:text-emerald-400 transition-colors">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold mb-2">Pazaryeri Karşılaştırması</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                Aynı ürünü farklı pazaryerlerinde karşılaştırarak en kârlı platformu belirleyin.
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Trendyol', value: 72, color: '#D97706' },
                  { name: 'Hepsiburada', value: 58, color: '#B45309' },
                  { name: 'n11', value: 45, color: '#92400E' },
                  { name: 'Amazon TR', value: 83, color: '#F59E0B' },
                ].map((bar) => (
                  <div key={bar.name} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-muted-foreground shrink-0">{bar.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${bar.value}%`, backgroundColor: bar.color }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-8 text-right">%{bar.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
