"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";
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
import type { DeliveryNote, DeliveryNoteLine } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";
import { todayIso } from "@/lib/utils";

const KINDS = ["Satış", "Alış"] as const;
const STATUSES = ["Taslak", "Düzenlendi", "Sevk edildi", "Teslim"] as const;

type LineForm = {
  description: string;
  quantityLabel: string;
  unit: string;
};

function emptyLine(): LineForm {
  return { description: "", quantityLabel: "1", unit: "adet" };
}

function defaultNoteNo() {
  const year = new Date().getFullYear();
  return `IRS-${year}-${String(Date.now()).slice(-4)}`;
}

function emptyForm(row?: DeliveryNote, lines?: DeliveryNoteLine[]) {
  return {
    noteNo: row?.noteNo ?? defaultNoteNo(),
    party: row?.party ?? "",
    kind: row?.kind ?? "Satış",
    issueDate: row?.issueDate || todayIso(),
    shipDate: row?.shipDate || todayIso(),
    warehouse: row?.warehouse ?? "",
    relatedOrderNo: row?.relatedOrderNo ?? "",
    relatedInvoiceNo: row?.relatedInvoiceNo ?? "",
    status: row?.status ?? "Taslak",
    lines:
      lines && lines.length > 0
        ? lines.map((l) => ({
            description: l.description,
            quantityLabel: l.quantityLabel,
            unit: l.unit,
          }))
        : [emptyLine()],
  };
}

export function DeliveryNoteFormSheet({
  open,
  onOpenChange,
  editing,
  editingLines,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: DeliveryNote | null;
  editingLines?: DeliveryNoteLine[];
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
    const lines = form.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantityLabel: l.quantityLabel.trim() || "1",
        unit: l.unit.trim() || "adet",
      }));
    if (!form.noteNo.trim() || !form.party.trim() || !form.warehouse.trim()) {
      toast.error("İrsaliye no, taraf ve depo zorunludur");
      return;
    }
    if (lines.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    setSaving(true);
    try {
      const body = {
        noteNo: form.noteNo.trim(),
        party: form.party.trim(),
        kind: form.kind,
        issueDate: form.issueDate,
        shipDate: form.shipDate,
        warehouse: form.warehouse.trim(),
        relatedOrderNo: form.relatedOrderNo.trim(),
        relatedInvoiceNo: form.relatedInvoiceNo.trim(),
        status: form.status,
        lines,
      };
      if (editing) {
        await updateCatalog("delivery-notes", editing.id, body);
        toast.success("İrsaliye güncellendi");
      } else {
        await createCatalog("delivery-notes", body);
        toast.success("İrsaliye oluşturuldu");
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
      icon={Truck}
      title={editing ? "İrsaliyeyi düzenle" : "Yeni irsaliye"}
      description="Sevk veya mal kabul irsaliyesini taraf, depo ve kalemlerle kaydedin."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="İrsaliye bilgisi">
            <FormField label="İrsaliye no" htmlFor="dn-no" required>
              <Input
                id="dn-no"
                required
                className="bg-white font-mono"
                value={form.noteNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, noteNo: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Müşteri / tedarikçi" htmlFor="dn-party" required>
              <Input
                id="dn-party"
                required
                className="bg-white"
                value={form.party}
                onChange={(e) =>
                  setForm((f) => ({ ...f, party: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Depo" htmlFor="dn-wh" required>
              <Input
                id="dn-wh"
                required
                className="bg-white"
                value={form.warehouse}
                onChange={(e) =>
                  setForm((f) => ({ ...f, warehouse: e.target.value }))
                }
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

          <FormSection title="Tarih ve bağlantı">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Düzenleme" htmlFor="dn-issue" required>
                <Input
                  id="dn-issue"
                  type="date"
                  required
                  className="bg-white"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Sevk tarihi" htmlFor="dn-ship" required>
                <Input
                  id="dn-ship"
                  type="date"
                  required
                  className="bg-white"
                  value={form.shipDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, shipDate: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Sipariş no" htmlFor="dn-order" optional>
                <Input
                  id="dn-order"
                  className="bg-white font-mono"
                  value={form.relatedOrderNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedOrderNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Fatura no" htmlFor="dn-inv" optional>
                <Input
                  id="dn-inv"
                  className="bg-white font-mono"
                  value={form.relatedInvoiceNo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      relatedInvoiceNo: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Kalemler"
            description={`${form.lines.filter((l) => l.description.trim()).length} kalem.`}
          >
            <div className="space-y-2">
              {form.lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2"
                >
                  <Input
                    placeholder="Malzeme / açıklama"
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
                        lines[i] = {
                          ...lines[i],
                          quantityLabel: e.target.value,
                        };
                        return { ...f, lines };
                      })
                    }
                  />
                  <Input
                    placeholder="Birim"
                    className="bg-white"
                    value={line.unit}
                    onChange={(e) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = { ...lines[i], unit: e.target.value };
                        return { ...f, lines };
                      })
                    }
                  />
                </div>
              ))}
            </div>
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
            {saving
              ? "Kaydediliyor…"
              : editing
                ? "Değişiklikleri kaydet"
                : "İrsaliyeyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
