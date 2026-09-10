"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:w-[32rem] sm:max-w-[32rem] p-0 gap-0 overflow-hidden",
          className
        )}
      >
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-indigo-600 to-blue-500" />
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(92dvh,52rem)] max-w-xl p-0",
          className
        )}
      >
        <DialogHeader className="relative shrink-0 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 px-6 pb-5 pt-6 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-3 pr-8">
            {Icon ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0">
              <DialogTitle className="text-white">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-sm text-white/75">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  required,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
          <span>{label}</span>
          {required ? (
            <span className="text-indigo-600" aria-hidden>
              *
            </span>
          ) : null}
          {optional ? (
            <span className="text-[9px] font-semibold normal-case tracking-normal text-muted-foreground/70">
              opsiyonel
            </span>
          ) : null}
        </Label>
      ) : null}
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormSheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FormSheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-2 bg-background">
      {children}
    </div>
  );
}
