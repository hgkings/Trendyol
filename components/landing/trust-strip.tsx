'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Clock, Layers, Store, Users } from 'lucide-react';

const stats = [
  { icon: Clock, value: 2, suffix: ' dk', label: 'Ortalama analiz süresi' },
  { icon: Layers, value: 8, suffix: '+', label: 'Hesaplanan gider kalemi' },
  { icon: Store, value: 4, suffix: '', label: 'Desteklenen pazaryeri' },
  { icon: Users, value: 500, suffix: '+', label: 'Aktif satıcı' },
];

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const steps = 40;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

export function TrustStrip() {
  return (
    <section className="py-20 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-700 dark:text-amber-400">
                <stat.icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-black tracking-tight text-foreground mb-1">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
