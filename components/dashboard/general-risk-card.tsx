'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, AlertOctagon, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';

type RiskLevel = 'safe' | 'moderate' | 'high';

export function GeneralRiskCard() {
    const { user } = useAuth();
    const router = useRouter();
    const [riskLevel, setRiskLevel] = useState<RiskLevel>('safe');
    const [reasons, setReasons] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const isPro = user?.plan === 'pro' || user?.plan === 'admin';

    useEffect(() => {
        if (!user || !isPro) return;

        const checkRisk = async () => {
            let level: RiskLevel = 'safe';
            const newReasons: string[] = [];

            // TODO: replace with fetch('/api/cash-plan/risk') when API is created
            const supabase = createClient();
            // 1. Check Cash Plan (HIGH RISK)
            const { data: cashPlan } = await supabase
                .from('cash_plan')
                .select('month, closing_cash')
                .eq('user_id', user.id)
                .lt('closing_cash', 0); // Only get negative months

            if (cashPlan && cashPlan.length > 0) {
                level = 'high';
                newReasons.push(`Nakit planında ${cashPlan.length} ayda açık görünüyor.`);
            }

            // 2. Check Target Margin vs Actual (MODERATE)
            // Note: In a real app we'd fetch actual average margin from 'analyses' table. 
            // For this card we'll keep it simple or hook into a context if available. 
            // Assuming we can't easily get aggregate analysis stats here without extra fetch, 
            // we'll focus on the cash plan and profile config.

            if (level !== 'high' && user.target_margin) {
                // If margin alert is enabled and logic was checked elsewhere, we show it here.
                // For now, let's skip the complex aggregation on client load to keep dashboard fast
                // unless we really want it.
            }

            // 3. Check Break-even (MODERATE)
            // If fixed costs are high (> 50k) and no target profit set, maybe warn?
            if (level !== 'high' && (user.fixed_cost_monthly || 0) > 50000) {
                // This is a naive heuristic, but serves the example.
                // Better: "Uncovered fixed costs" if we had revenue data.
            }

            if (newReasons.length === 0) {
                newReasons.push('Finansal durumunuz şu an dengeli görünüyor.');
            }

            setRiskLevel(level);
            setReasons(newReasons);
            setLoading(false);
        };

        checkRisk();
    }, [user, isPro]);

    if (!isPro) return null;
    if (loading) return null;

    const styles = {
        safe: {
            border: 'border-emerald-500/30',
            bg: 'bg-emerald-500/10',
            text: 'text-emerald-400',
            icon: ShieldCheck,
            label: 'Düşük Risk',
            btn: 'text-emerald-400 hover:text-emerald-300'
        },
        moderate: {
            border: 'border-amber-500/30',
            bg: 'bg-amber-500/10',
            text: 'text-amber-400',
            icon: AlertTriangle,
            label: 'Orta Risk',
            btn: 'text-amber-400 hover:text-amber-300'
        },
        high: {
            border: 'border-red-500/30',
            bg: 'bg-red-500/10',
            text: 'text-red-400',
            icon: AlertOctagon,
            label: 'Yüksek Risk',
            btn: 'text-red-400 hover:text-red-300'
        }
    };

    const style = styles[riskLevel];
    const Icon = style.icon;

    return (
        <Card className={`shadow-sm border-l-4 ${style.border} ${style.bg}`}>
            <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className={`h-5 w-5 ${style.text}`} />
                        Risk Durumu
                    </CardTitle>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border bg-black/20 ${style.text} border-current opacity-80`}>
                        {style.label}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pb-4">
                <ul className="space-y-1 mb-3">
                    {reasons.slice(0, 2).map((r, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-50 shrink-0" />
                            {r}
                        </li>
                    ))}
                </ul>

                <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 px-0 text-xs gap-1 hover:bg-transparent ${style.btn}`}
                    onClick={() => router.push('/cash-plan')}
                >
                    Nakit Planını İncele <ArrowRight className="h-3 w-3" />
                </Button>
            </CardContent>
        </Card>
    );
}
