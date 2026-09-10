import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  badge: string;
  title: ReactNode;
  description?: string;
  badgeClassName?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  badge,
  title,
  description,
  badgeClassName,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
      <div className="relative z-10">
        <span
          className={cn(
            "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-md border w-fit",
            badgeClassName ?? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
          )}
        >
          {badge}
        </span>
        <h1 className="text-4xl font-black tracking-tight text-foreground leading-none mt-2">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground mt-3 font-medium text-sm lg:text-base max-w-2xl opacity-80 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions && <div className="flex items-center gap-3 relative z-10">{actions}</div>}
      <div className="absolute -top-10 -left-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse" />
    </div>
  );
}
