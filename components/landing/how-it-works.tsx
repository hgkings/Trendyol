'use client';

import { motion } from 'framer-motion';
import { ClipboardList, BarChart2, CheckCircle2, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: ClipboardList,
    title: 'Ürün Bilgilerini Gir',
    desc: 'Pazaryeri, fiyat, maliyet ve gider bilgilerini girin.',
  },
  {
    number: '2',
    icon: BarChart2,
    title: 'Analiz Et',
    desc: 'Sistem tüm maliyetleri hesaplayarak gerçek kârı ve risk seviyesini belirler.',
  },
  {
    number: '3',
    icon: CheckCircle2,
    title: 'Karar Ver',
    desc: 'Detaylı rapor ve önerilerle stratejik kararlar alın, kârlı ürünleri ölçeklendirin.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block mb-3 rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-500/12 text-amber-800 dark:text-amber-300">
            Nasıl Çalışır?
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl mb-4" style={{ letterSpacing: '-0.5px' }}>
            3 adımda{' '}
            <span style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              kârlılığınızı
            </span>{' '}ölçün
          </h2>
          <p className="text-base text-muted-foreground">
            Daha doğru ticaret yapın, zarar eden ürünleri erken tespit edin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="group flex flex-col items-center text-center w-full h-full rounded-2xl border border-border/40 bg-card p-8 hover:border-amber-500/30 hover:shadow-md transition-all duration-300"
              >
                {/* Number badge */}
                <span
                  className="text-5xl font-black mb-5 leading-none select-none"
                  style={{ background: 'linear-gradient(to bottom, #D97706, rgba(217,119,6,0.2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {step.number}
                </span>

                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-5 transition-all duration-300 bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400 group-hover:scale-110 group-hover:shadow-lg group-hover:bg-amber-500 group-hover:text-white">
                  <step.icon className="h-8 w-8 transition-colors duration-300" />
                </div>

                <h3 className="text-lg font-semibold mb-3 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                  {step.desc}
                </p>
              </motion.div>

              {i < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-muted/10 border border-border/40 shadow-sm">
                  <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
