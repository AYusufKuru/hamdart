"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
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
