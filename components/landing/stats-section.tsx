'use client';

import { useEffect, useRef, useState } from 'react';
import { Users, TrendingUp, Zap, Target } from 'lucide-react';

function useCountUp(target: number, duration: number = 1500, start: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, start]);

  return count;
}

export function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const stats = [
    { value: 500, suffix: "+", label: "Aktif Satıcı", icon: Users },
    { value: 40, prefix: "%", suffix: "", label: "Ort. Kâr Artışı", icon: TrendingUp },
    { value: 2, suffix: " dk", label: "Analiz Süresi", icon: Zap },
    { value: 8, suffix: "+", label: "Gider Kalemi", icon: Target },
  ];

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div
          ref={ref}
          className="py-16 rounded-[2rem] mx-4 max-w-6xl md:mx-auto border border-border/40 bg-card"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 px-6 text-center">
            {stats.map((stat, idx) => {
              const count = useCountUp(stat.value, 2000, visible);
              return (
                <div key={idx} className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-amber-500/8 border border-amber-500/12 rounded-2xl mb-2">
                    <stat.icon className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="text-4xl md:text-5xl font-bold text-amber-700 dark:text-amber-400 tabular-nums tracking-tight">
                    {stat.prefix}{count}{stat.suffix}
                  </div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
