'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Store, ArrowRight, Loader2 } from 'lucide-react';

const PAZARYERLERI = [
    {
        id: 'trendyol',
        isim: 'Trendyol',
        emoji: '🟠',
        finansEndpoint: '/api/marketplace/trendyol/finance',
    },
    {
        id: 'hepsiburada',
        isim: 'Hepsiburada',
        emoji: '🟡',
        finansEndpoint: '/api/marketplace/hepsiburada/finance',
    },
] as const;

interface BagliPazaryeri {
    id: string;
    status: string;
    supplier_id?: string;
    merchant_id?: string;
}

interface Veri {
    toplamKomisyon: number;
    toplamHakedis: number;
    toplamIade: number;
    kayitSayisi: number;
}

interface Props {
    bagliPazaryerleri: BagliPazaryeri[];
}

export function PazaryeriIstatistikKarti({ bagliPazaryerleri }: Props) {
    const baglilar = PAZARYERLERI.filter((p) =>
        bagliPazaryerleri.some((b) => b.id === p.id && b.status === 'connected')
    );

    const [seciliId, setSeciliId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('son_pazaryeri');
            if (saved && baglilar.some((p) => p.id === saved)) return saved;
        }
        return baglilar[0]?.id ?? '';
    });

    const [veri, setVeri] = useState<Veri | null>(null);
    const [yukleniyor, setYukleniyor] = useState(false);
    const [hata, setHata] = useState<string | null>(null);

    useEffect(() => {
        if (!seciliId && baglilar.length > 0) {
            setSeciliId(baglilar[0].id);
        }
    }, [baglilar.length]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!seciliId) return;
        if (typeof window !== 'undefined') localStorage.setItem('son_pazaryeri', seciliId);
        veriCek(seciliId);
    }, [seciliId]); // eslint-disable-line react-hooks/exhaustive-deps

    const veriCek = async (id: string) => {
        const pazaryeri = PAZARYERLERI.find((p) => p.id === id);
        if (!pazaryeri) return;
        setYukleniyor(true);
        setHata(null);
        setVeri(null);
        try {
            const bugun = new Date();
            const baslangic = new Date();
            baslangic.setDate(bugun.getDate() - 30);
            const fmt = (d: Date) => d.toISOString().slice(0, 10);
            const res = await fetch(`${pazaryeri.finansEndpoint}?startDate=${fmt(baslangic)}&endDate=${fmt(bugun)}`);
            if (!res.ok) throw new Error('Finans verisi alinamadi');
            const json = await res.json();
            const rows: Array<{ komisyonTutari?: number; saticiHakedis?: number }> = json.data ?? [];
            setVeri({
                toplamKomisyon: json.ozet?.toplamKomisyon ?? rows.reduce((s: number, r) => s + (r.komisyonTutari ?? 0), 0),
                toplamHakedis: json.ozet?.toplamHakedis ?? rows.reduce((s: number, r) => s + (r.saticiHakedis ?? 0), 0),
                toplamIade: json.ozet?.toplamIadeTutari ?? json.toplamIade ?? 0,
                kayitSayisi: json.toplam ?? rows.length,
            });
        } catch (e: unknown) {
            setHata(e instanceof Error ? e.message : 'Bilinmeyen hata');
        } finally {
            setYukleniyor(false);
        }
    };

    const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });

    // ── Disconnected: Compact banner ──
    if (baglilar.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <Link href="/marketplace">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-r from-amber-500/[0.04] to-transparent px-4 py-3 hover:border-amber-500/20 transition-all cursor-pointer group">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-amber-500/10">
                                <Store className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                            </div>
                            <div>
                                <span className="text-sm font-medium">Pazaryeri Bagla</span>
                                <p className="text-[10px] text-muted-foreground">Komisyon, kargo ve iade verileri otomatik gelsin</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors" />
                    </div>
                </Link>
            </motion.div>
        );
    }

    // ── Connected state ──
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-border/40 bg-card p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-sm font-semibold">Pazaryeri Istatistikleri</span>
                </div>
                <div className="flex items-center gap-2">
                    {yukleniyor ? (
                        <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Yukleniyor
                        </span>
                    ) : hata ? (
                        <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">Baglanti Hatasi</span>
                    ) : (
                        <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">Canli Veri</span>
                    )}
                    {baglilar.length > 1 && (
                        <select
                            value={seciliId}
                            onChange={(e) => setSeciliId(e.target.value)}
                            className="text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-foreground cursor-pointer"
                        >
                            {baglilar.map((p) => (
                                <option key={p.id} value={p.id}>{p.emoji} {p.isim}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {yukleniyor && (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />
                    ))}
                </div>
            )}

            {!yukleniyor && hata && (
                <div className="text-center py-4">
                    <p className="text-sm text-red-400 mb-2">{hata}</p>
                    <button onClick={() => veriCek(seciliId)} className="text-xs text-emerald-700 dark:text-emerald-400 underline">
                        Tekrar dene
                    </button>
                </div>
            )}

            {!yukleniyor && !hata && veri && (
                <>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="rounded-lg bg-red-500/[0.06] border border-red-500/10 p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">Komisyon</p>
                            <p className="text-sm font-bold text-red-400 tabular-nums">{fmt(veri.toplamKomisyon)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10 p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">Hakedis</p>
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{fmt(veri.toplamHakedis)}</p>
                        </div>
                        <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/10 p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">Iade</p>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">{fmt(veri.toplamIade)}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 border-t border-white/[0.04]">
                        <span>Son 30 gunde {veri.kayitSayisi} islem</span>
                        <Link href="/marketplace" className="text-emerald-700 dark:text-emerald-400 hover:underline">Detaylar →</Link>
                    </div>
                </>
            )}
        </motion.div>
    );
}
