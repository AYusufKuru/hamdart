"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Landmark, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { CashAccount, CashCurrency } from "@/lib/cash-accounts";
import { CASH_CURRENCIES } from "@/lib/cash-accounts";
import { createCashAccount, updateCashAccount } from "@/lib/catalog-store";

function emptyForm(row?: CashAccount | null) {
  return {
    name: row?.name ?? "",
    bankName: row?.bankName ?? "",
    iban: row?.iban ?? "",
    branch: row?.branch ?? "",
    accountNo: row?.accountNo ?? "",
    currency: (row?.currency ?? "TRY") as CashCurrency,
    openingBalance: row ? String(row.openingBalance) : "0",
    notes: row?.notes ?? "",
  };
}

export function CashAccountFormSheet({
  open,
  onOpenChange,
  editing,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CashAccount | null;
  mode: "cash" | "bank";
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const isCash = mode === "cash";

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm(editing ?? null));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const openingBalance = Number(form.openingBalance.replace(",", "."));
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      toast.error("Açılış bakiyesi 0 veya daha büyük olmalıdır");
      return;
    }
    if (!isCash) {
      if (!form.name.trim()) {
        toast.error("Hesap adı zorunludur");
        return;
      }
      if (!form.bankName.trim()) {
        toast.error("Banka adı zorunludur");
        return;
      }
    }

    setSaving(true);
    try {
      const body = {
        name: form.name,
        bankName: form.bankName,
        iban: form.iban,
        branch: form.branch,
        accountNo: form.accountNo,
        currency: form.currency,
        openingBalance,
        notes: form.notes,
      };
      if (editing) {
        await updateCashAccount(editing.id, body);
        toast.success(isCash ? "Kasa güncellendi" : "Banka hesabı güncellendi");
      } else {
        await createCashAccount(body);
        toast.success("Banka hesabı eklendi");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isCash
          ? editing
            ? editing.name
            : "Kasa"
          : editing
            ? "Banka hesabını düzenle"
            : "Yeni banka hesabı"
      }
      description={
        isCash
          ? "Sistem kasasının açılış bakiyesini ve notunu güncelleyin."
          : "Şirket banka hesabını kaydedin."
      }
      icon={isCash ? Wallet : Landmark}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody>
          {isCash ? (
            <FormSection title="Kasa">
              <FormField label="Açılış bakiyesi">
                <Input
                  inputMode="decimal"
                  value={form.openingBalance}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, openingBalance: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Not">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </FormField>
            </FormSection>
          ) : (
            <FormSection title="Hesap">
              <FormField label="Hesap adı" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Örn. Vadesiz TL"
                />
              </FormField>
              <FormField label="Banka" required>
                <Input
                  value={form.bankName}
                  onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  placeholder="Örn. Ziraat Bankası"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="IBAN">
                  <Input
                    value={form.iban}
                    onChange={(e) => setForm((prev) => ({ ...prev, iban: e.target.value }))}
                    placeholder="TR.."
                    className="font-mono"
                  />
                </FormField>
                <FormField label="Hesap no">
                  <Input
                    value={form.accountNo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, accountNo: e.target.value }))
                    }
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Şube">
                  <Input
                    value={form.branch}
                    onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
                  />
                </FormField>
                <FormField label="Para birimi">
                  <Select
                    value={form.currency}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, currency: value as CashCurrency }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASH_CURRENCIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Açılış bakiyesi">
                <Input
                  inputMode="decimal"
                  value={form.openingBalance}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, openingBalance: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Not">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </FormField>
            </FormSection>
          )}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
