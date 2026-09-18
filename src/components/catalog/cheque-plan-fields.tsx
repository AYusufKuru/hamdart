"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/form-sheet";
import {
  CHEQUE_INSTALLMENT_COUNTS,
  parseChequeMoney,
  remainingChequeAmount,
  suggestChequeInstallment,
} from "@/lib/cheque-notes";
import { formatNumber } from "@/lib/utils";

export type ChequePlanDraft = { dueDate: string; amount: string };

export function emptyChequePlan(count: number): ChequePlanDraft[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ dueDate: "", amount: "" }));
}

export function fillChequePlanStep(
  rows: ChequePlanDraft[],
  index: number,
  total: number,
  issueDate: string
): ChequePlanDraft[] {
  const next = rows.slice();
  while (next.length <= index) next.push({ dueDate: "", amount: "" });
  const current = next[index];
  if (current.dueDate && current.amount.trim()) return next;
  const suggested = suggestChequeInstallment({
    total,
    previousAmounts: next.slice(0, index).map((row) => parseChequeMoney(row.amount)),
    remainingCount: Math.max(1, next.length - index),
    previousDue: next[index - 1]?.dueDate,
    issueDate,
  });
  next[index] = {
    dueDate: current.dueDate || suggested.dueDate,
    amount: current.amount.trim() || String(suggested.amount),
  };
  return next;
}

export function ChequeInstallmentCountField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormField label="Taksit sayısı" optional>
      <Select value={value || "none"} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Taksit yok" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Taksit yok</SelectItem>
          {CHEQUE_INSTALLMENT_COUNTS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} taksit
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function ChequeInstallmentStep({
  index,
  count,
  totalAmount,
  previousAmounts,
  row,
  onChange,
  locked,
}: {
  index: number;
  count: number;
  totalAmount: number;
  previousAmounts: number[];
  row: ChequePlanDraft;
  onChange: (row: ChequePlanDraft) => void;
  locked?: boolean;
}) {
  const amount = parseChequeMoney(row.amount);
  const remainingAfter = remainingChequeAmount(totalAmount, [...previousAmounts, amount]);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">
          {index + 1}. taksit / {count}
        </p>
        {totalAmount > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(totalAmount)} ₺
            {amount > 0 ? ` · ${formatNumber(amount)} ₺` : ""}
            {amount > 0 && remainingAfter > 0.009
              ? ` · kalan ${formatNumber(remainingAfter)} ₺`
              : ""}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Taksit tutarı" required>
          <Input
            type="text"
            inputMode="decimal"
            className="bg-white"
            disabled={locked}
            value={row.amount}
            onChange={(e) => onChange({ ...row, amount: e.target.value })}
            placeholder="25000"
          />
        </FormField>
        <FormField label="Vade tarihi" required>
          <Input
            type="date"
            className="bg-white"
            disabled={locked}
            value={row.dueDate}
            onChange={(e) => onChange({ ...row, dueDate: e.target.value })}
          />
        </FormField>
      </div>
    </div>
  );
}
