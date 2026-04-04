'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionSection({ icon, title, children, defaultOpen = false }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 opacity-40 transition-transform duration-300 ${open ? 'rotate-180 opacity-70' : ''}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/10 px-5 pb-5 pt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
