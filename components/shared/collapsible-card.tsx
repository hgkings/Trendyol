'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CollapsibleCardProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
}

export function CollapsibleCard({
    title,
    description,
    children,
    defaultOpen = true,
    className,
}: CollapsibleCardProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={cn(
            "rounded-2xl border bg-card border-border/40 transition-all duration-200",
            isOpen && "border-amber-600/40",
            className
        )}>
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/15 active:bg-muted/20 transition-colors rounded-t-2xl"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold leading-none tracking-tight text-stone-50">{title}</h3>
                    {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                    )}
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </Button>
            </div>

            {/* Content */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="overflow-hidden">
                    <div className="p-4 pt-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
