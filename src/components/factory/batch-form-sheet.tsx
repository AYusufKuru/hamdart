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
import {
  productionLines as seedLines,
  type BatchStatus,
  type ProductionLine,
} from "@/data/mock";
import { plusDaysIso, todayIso } from "@/lib/utils";
import {
  BATCH_STATUS_OPTIONS,
  BATCH_UNITS,
  createProductionBatch,
  getAllProductionLines,
  getKnownProducts,
  nextBatchNo,
  suggestUnit,
} from "@/lib/production-store";

function emptyForm(lines: ProductionLine[]) {
  const preferred =
    lines.find((l) => l.status === "idle") ??
    lines.find((l) => l.status === "active") ??
    lines[0];
  const lineName = preferred?.name ?? "";
  const product =
    preferred?.product && preferred.product !== "-" ? preferred.product : "";
  return {
    batchNo: lineName ? nextBatchNo(lineName) : "",
    product,
    line: lineName,
    status: "in_progress" as BatchStatus,
    quantity: "",
    unit: suggestUnit(product, lineName),
    startDate: todayIso(),
    endDate: plusDaysIso(2),
    yield: "0",
    qcScore: "0",
  };
}

interface BatchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function BatchFormSheet({
  open,
  onOpenChange,
  onCreated,
}: BatchFormSheetProps) {
  const [lines, setLines] = useState<ProductionLine[]>(seedLines);
  const [products, setProducts] = useState<string[]>([]);
  const [form, setForm] = useState(() => emptyForm(seedLines));

  useEffect(() => {
    if (!open) return;
    const allLines = getAllProductionLines();
    setLines(allLines);
    setProducts(getKnownProducts());
    setForm(emptyForm(allLines));
  }, [open]);

  const selectedLine = lines.find((l) => l.name === form.line);

  function applyLine(lineName: string) {
    const line = lines.find((l) => l.name === lineName);
    const product =
      line?.product && line.product !== "-" ? line.product : form.product;
    setForm((f) => ({
      ...f,
      line: lineName,
      product,
      batchNo: nextBatchNo(lineName),
      unit: suggestUnit(product, lineName),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const yieldValue = parseFloat(form.yield);
    const qcScore = parseFloat(form.qcScore);

    if (!form.product.trim() || !form.line) {
      toast.error("Ürün ve hat zorunludur");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz");
      return;
    }
    if (
      !Number.isFinite(yieldValue) ||
      yieldValue < 0 ||
      yieldValue > 100
    ) {
      toast.error("Verim 0–100 arasında olmalıdır");
      return;
    }
    if (!Number.isFinite(qcScore) || qcScore < 0 || qcScore > 100) {
      toast.error("KK skoru 0–100 arasında olmalıdır");
      return;
    }

    if (selectedLine?.status === "maintenance") {
      toast.warning("Seçilen hat bakımda — batch yine de kaydedildi");
    }

    try {
      const created = createProductionBatch({
        batchNo: form.batchNo,
        product: form.product,
        line: form.line,
        status: form.status,
        quantity,
        unit: form.unit,
        startDate: form.startDate,
        endDate: form.endDate,
        yield: yieldValue,
        qcScore,
      });

      toast.success(`${created.batchNo} başlatıldı`);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch kaydedilemedi");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni Batch Başlat"
      description="Batch numarası hatta göre üretilir. Üretimde kaydı, hat kartındaki güncel batch’i günceller."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField
            label="Üretim Hattı"
            hint={
              selectedLine
                ? `Durum: ${selectedLine.status === "active" ? "Aktif" : selectedLine.status === "idle" ? "Boşta" : selectedLine.status === "maintenance" ? "Bakımda" : "Uyarı"} · mevcut batch: ${selectedLine.currentBatch}`
                : "Tablodaki Hat sütunu."
            }
          >
            <Select value={form.line || undefined} onValueChange={applyLine}>
              <SelectTrigger>
                <SelectValue placeholder="Hat seçin" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Batch No"
            htmlFor="batch-no"
            hint="Tablet: BT, şurup: SR, enjeksiyon/steril: INJ, kapsül: CAP."
          >
            <Input
              id="batch-no"
              required
              className="font-mono"
              value={form.batchNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, batchNo: e.target.value }))
              }
            />
          </FormField>

          <FormField label="Ürün" htmlFor="batch-product">
            <Input
              id="batch-product"
              list="batch-product-list"
              required
              placeholder="Örn: CardioMax 50mg"
              value={form.product}
              onChange={(e) => {
                const product = e.target.value;
                setForm((f) => ({
                  ...f,
                  product,
                  unit: suggestUnit(product, f.line),
                }));
              }}
            />
            <datalist id="batch-product-list">
              {products.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Miktar" htmlFor="batch-qty">
              <Input
                id="batch-qty"
                type="number"
                required
                min={1}
                step="any"
                placeholder="500000"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Birim">
              <Select
                value={form.unit}
                onValueChange={(unit) => setForm((f) => ({ ...f, unit }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Durum"
            hint="Başlat için Üretimde. Yeni batch’te KK skoru genelde 0 kalır (tabloda —)."
          >
            <Select
              value={form.status}
              onValueChange={(status) =>
                setForm((f) => ({ ...f, status: status as BatchStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Başlangıç" htmlFor="batch-start">
              <Input
                id="batch-start"
                type="date"
                required
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Bitiş" htmlFor="batch-end">
              <Input
                id="batch-end"
                type="date"
                required
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Verim (%)"
              htmlFor="batch-yield"
              hint="Yeni üretimde 0 bırakılabilir."
            >
              <Input
                id="batch-yield"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.yield}
                onChange={(e) =>
                  setForm((f) => ({ ...f, yield: e.target.value }))
                }
              />
            </FormField>
            <FormField
              label="KK Skoru (%)"
              htmlFor="batch-qc"
              hint="0 ise tabloda tire görünür."
            >
              <Input
                id="batch-qc"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={form.qcScore}
                onChange={(e) =>
                  setForm((f) => ({ ...f, qcScore: e.target.value }))
                }
              />
            </FormField>
          </div>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            İptal
          </Button>
          <Button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            Batch’i Başlat
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
