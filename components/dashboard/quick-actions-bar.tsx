'use client';

import Link from 'next/link';
import { Plus, FileSpreadsheet, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function QuickActionsBar() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center gap-2 overflow-x-auto pb-1"
        >
            <Link href="/analysis/new">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-600/25 transition-colors whitespace-nowrap">
                    <Plus className="h-3.5 w-3.5" />
                    Yeni Analiz
                </button>
            </Link>
            <Link href="/products">
                <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/10 border border-border/40 text-muted-foreground text-xs font-medium hover:bg-muted/30 hover:text-foreground transition-colors whitespace-nowrap">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    CSV Ice Aktar
                </button>
            </Link>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/10 border border-border/40 text-muted-foreground/50 text-xs font-medium cursor-not-allowed whitespace-nowrap" disabled>
                        <FileText className="h-3.5 w-3.5" />
                        PDF Rapor
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Yakinda</TooltipContent>
            </Tooltip>
        </motion.div>
    );
}
