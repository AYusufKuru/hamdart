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
import type { Invoice, InvoiceLine } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";
import { todayIso } from "@/lib/utils";

const KINDS = ["Satış", "Alış"] as const;
const STATUSES = ["Ödenmedi", "Ödendi", "Kısmi", "İptal"] as const;

type LineForm = {
  description: string;
  quantityLabel: string;
  unitPrice: string;
  lineTotal: string;
};

function emptyLine(): LineForm {
  return { description: "", quantityLabel: "1", unitPrice: "", lineTotal: "" };
}

function emptyForm(row?: Invoice, lines?: InvoiceLine[]) {
  return {
    invoiceNo: row?.invoiceNo ?? "",
    party: row?.party ?? "",
    kind: row?.kind ?? "Satış",
    issueDate: row?.issueDate || todayIso(),
    dueDate: row?.dueDate || todayIso(),
    amount: row ? String(row.amount) : "",
    status: row?.status ?? "Ödenmedi",
    lines:
      lines && lines.length > 0
        ? lines.map((l) => ({
            description: l.description,
            quantityLabel: l.quantityLabel,
            unitPrice: String(l.unitPrice),
            lineTotal: String(l.lineTotal),
          }))
        : [],
  };
}

export function InvoiceFormSheet({
  open,
  onOpenChange,
  editing,
  editingLines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Invoice | null;
  editingLines?: InvoiceLine[];
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm(editing ?? undefined, editingLines));
  }, [open, editing, editingLines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = form.amount === "" ? undefined : Number(form.amount);
    const lines = form.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantityLabel: l.quantityLabel.trim() || "1",
        unitPrice: Number(l.unitPrice) || 0,
        lineTotal: Number(l.lineTotal) || Number(l.unitPrice) || 0,
      }));
    if (!form.invoiceNo.trim() || !form.party.trim()) {
      toast.error("Fatura no ve taraf zorunludur");
      return;
    }
    if (amount === undefined && lines.length === 0) {
      toast.error("Tutar veya en az bir kalem girin");
      return;
    }
    setSaving(true);
    try {
      const body = {
        invoiceNo: form.invoiceNo.trim(),
        party: form.party.trim(),
        kind: form.kind,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}),
        ...(lines.length > 0 ? { lines } : {}),
      };
      if (editing) {
        await updateCatalog("invoices", editing.id, body);
        toast.success("Fatura güncellendi");
      } else {
        await createCatalog("invoices", body);
        toast.success("Fatura eklendi");
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
      title={editing ? "Fatura düzenle" : "Yeni fatura"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Fatura no" htmlFor="inv-no">
            <Input
              id="inv-no"
              required
              value={form.invoiceNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoiceNo: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Müşteri / Tedarikçi" htmlFor="inv-party">
            <Input
              id="inv-party"
              required
              value={form.party}
              onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <Select
                value={form.kind}
                onValueChange={(kind) => setForm((f) => ({ ...f, kind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Düzenleme" htmlFor="inv-issue">
              <Input
                id="inv-issue"
                type="date"
                required
                value={form.issueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issueDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Vade" htmlFor="inv-due">
              <Input
                id="inv-due"
                type="date"
                required
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </FormField>
          </div>
          <FormField label="Tutar (₺)" htmlFor="inv-amt">
            <Input
              id="inv-amt"
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
          </FormField>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Kalemler</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
                }
              >
                Kalem ekle
              </Button>
            </div>
            {form.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border p-2">
                <Input
                  placeholder="Açıklama"
                  value={line.description}
                  onChange={(e) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], description: e.target.value };
                      return { ...f, lines };
                    })
                  }
                />
                <Input
                  placeholder="Miktar"
                  value={line.quantityLabel}
                  onChange={(e) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], quantityLabel: e.target.value };
                      return { ...f, lines };
                    })
                  }
                />
                <Input
                  placeholder="Birim fiyat"
                  type="number"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], unitPrice: e.target.value };
                      return { ...f, lines };
                    })
                  }
                />
                <Input
                  placeholder="Kalem toplam"
                  type="number"
                  value={line.lineTotal}
                  onChange={(e) =>
                    setForm((f) => {
                      const lines = [...f.lines];
                      lines[i] = { ...lines[i], lineTotal: e.target.value };
                      return { ...f, lines };
                    })
                  }
                />
              </div>
            ))}
          </div>
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
