"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { LedgerEntry } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";
import { todayIso } from "@/lib/utils";

const DIRECTIONS = ["Girdi", "Çıktı"] as const;
const STATUSES = ["Kasa Onayladı", "Bekliyor", "İptal"] as const;

function emptyForm(row?: LedgerEntry) {
  return {
    date: row?.date || todayIso(),
    documentNo: row?.documentNo ?? "",
    description: row?.description ?? "",
    category: row?.category ?? "",
    direction: row?.direction ?? "Girdi",
    amount: row ? String(row.amount) : "",
    status: row?.status ?? "Bekliyor",
  };
}

export function LedgerFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: LedgerEntry | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm(editing ?? undefined));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.documentNo.trim() || !form.description.trim()) {
      toast.error("Belge no ve açıklama zorunludur");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Tutar 0 veya daha büyük olmalıdır");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, amount };
      if (editing) {
        await updateCatalog("ledger", editing.id, body);
        toast.success("Yevmiye güncellendi");
      } else {
        await createCatalog("ledger", body);
        toast.success("Yevmiye eklendi");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Yevmiye düzenle" : "Yeni yevmiye"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Tarih" htmlFor="led-date">
            <Input
              id="led-date"
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </FormField>
          <FormField label="Belge no" htmlFor="led-doc">
            <Input
              id="led-doc"
              required
              value={form.documentNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, documentNo: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Açıklama" htmlFor="led-desc">
            <Input
              id="led-desc"
              required
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Kategori" htmlFor="led-cat">
            <Input
              id="led-cat"
              required
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Yön">
              <Select
                value={form.direction}
                onValueChange={(direction) =>
                  setForm((f) => ({ ...f, direction }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Durum">
              <Select
                value={form.status}
                onValueChange={(status) => setForm((f) => ({ ...f, status }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="Tutar (₺)" htmlFor="led-amt">
            <Input
              id="led-amt"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </FormField>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
