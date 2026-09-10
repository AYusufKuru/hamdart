"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
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
  FormDialog,
  FormField,
  FormSection,
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
    if (open) {
      setSaving(false);
      setForm(emptyForm(editing ?? undefined, editingLines));
    }
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FileText}
      title={editing ? "Faturayı düzenle" : "Yeni fatura"}
      description="Satış veya alış faturasını taraf, tarih ve kalemlerle kaydedin."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Fatura bilgisi">
            <FormField label="Fatura no" htmlFor="inv-no" required>
              <Input
                id="inv-no"
                required
                className="bg-white font-mono"
                value={form.invoiceNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, invoiceNo: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Müşteri / tedarikçi" htmlFor="inv-party" required>
              <Input
                id="inv-party"
                required
                className="bg-white"
                value={form.party}
                onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Tür" required>
                <Select
                  value={form.kind}
                  onValueChange={(kind) => setForm((f) => ({ ...f, kind }))}
                >
                  <SelectTrigger className="bg-white">
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
              <FormField label="Durum" required>
                <Select
                  value={form.status}
                  onValueChange={(status) => setForm((f) => ({ ...f, status }))}
                >
                  <SelectTrigger className="bg-white">
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
          </FormSection>

          <FormSection title="Tarih ve tutar">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Düzenleme" htmlFor="inv-issue" required>
                <Input
                  id="inv-issue"
                  type="date"
                  required
                  className="bg-white"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Vade" htmlFor="inv-due" required>
                <Input
                  id="inv-due"
                  type="date"
                  required
                  className="bg-white"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField label="Toplam tutar" htmlFor="inv-amt" optional hint="Kalem girmezseniz toplam tutarı yazın.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="inv-amt"
                  type="number"
                  min={0}
                  step="0.01"
                  className="bg-white pl-8"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
            </FormField>
          </FormSection>

          <FormSection
            title="Kalemler"
            description={form.lines.length > 0 ? `${form.lines.length} kalem.` : "Opsiyonel satır detayı."}
          >
            {form.lines.length > 0 && (
              <div className="space-y-2">
                {form.lines.map((line, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2"
                  >
                    <Input
                      placeholder="Açıklama"
                      className="bg-white sm:col-span-2"
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
                      className="bg-white"
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
                      className="bg-white"
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
                      className="bg-white sm:col-span-2"
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
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-dashed sm:w-auto"
              onClick={() =>
                setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Kalem ekle
            </Button>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving} className="rounded-xl">
            {saving ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Faturayı kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
