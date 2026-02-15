import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: ReactNode; // Actions slot (buttons, etc.)
    className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border/60", className)}>
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
