"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { LabSample } from "@/data/mock";
import {
  createLabSample,
  getLabAnalysts,
  getSampleTypes,
  nextSampleNo,
  SAMPLE_STATUSES,
  SAMPLE_TYPES,
} from "@/lib/lab-store";
import { getAllProductionBatches } from "@/lib/production-store";
import { getOrderProducts } from "@/lib/order-store";
import { todayIso } from "@/lib/utils";

function emptyForm() {
  return {
    sampleNo: nextSampleNo(),
    product: "",
    batchNo: "",
    type: "Üretim Numunesi",
    status: "received" as LabSample["status"],
    receivedDate: todayIso(),
    analyst: "",
    result: "",
  };
}

interface SampleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function SampleFormSheet({
  open,
  onOpenChange,
  onCreated,
}: SampleFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [products, setProducts] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([...SAMPLE_TYPES]);
  const [analysts, setAnalysts] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    const batchList = getAllProductionBatches();
    setBatches(batchList.map((b) => b.batchNo));
    setProducts(
      [
        ...new Set([
          ...getOrderProducts(),
          ...batchList.map((b) => b.product),
        ]),
      ].sort((a, b) => a.localeCompare(b, "tr"))
    );
    setTypes(getSampleTypes());
    setAnalysts(getLabAnalysts());
  }, [open]);

  function applyBatch(batchNo: string) {
    const match = getAllProductionBatches().find((b) => b.batchNo === batchNo);
    setForm((f) => ({
      ...f,
      batchNo,
      product: match?.product ?? f.product,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product.trim() || !form.batchNo.trim() || !form.analyst.trim()) {
      toast.error("Ürün, batch ve analist zorunludur");
      return;
    }

    try {
      const created = createLabSample({
        sampleNo: form.sampleNo,
        product: form.product,
        batchNo: form.batchNo,
        type: form.type,
        status: form.status,
        receivedDate: form.receivedDate,
        analyst: form.analyst,
        result: form.result || undefined,
      });

      toast.success(`${created.sampleNo} kaydedildi`);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Numune kaydedilemedi");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Numune Kaydı"
      description="Numune no otomatik üretilir. Batch seçilince ürün dolar. Sonuç boşsa tabloda — görünür."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Numune No" htmlFor="smp-no">
            <Input
              id="smp-no"
              required
              className="font-mono"
              value={form.sampleNo}
              onChange={(e) =>
                setForm((f) => ({ ...f, sampleNo: e.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Batch"
            hint="Üretimdeki batch numaraları. Serbest de yazılabilir."
          >
            <Input
              list="smp-batch-list"
              required
              className="font-mono"
              placeholder="Örn: BT-2026-0847"
              value={form.batchNo}
              onChange={(e) => applyBatch(e.target.value)}
            />
            <datalist id="smp-batch-list">
              {batches.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Ürün" htmlFor="smp-product">
            <Input
              id="smp-product"
              list="smp-product-list"
              required
              placeholder="Örn: CardioMax 50mg"
              value={form.product}
              onChange={(e) =>
                setForm((f) => ({ ...f, product: e.target.value }))
              }
            />
            <datalist id="smp-product-list">
              {products.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tip">
              <Select
                value={form.type}
                onValueChange={(type) => setForm((f) => ({ ...f, type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Durum">
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((f) => ({
                    ...f,
                    status: status as LabSample["status"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Analist" htmlFor="smp-analyst">
            <Input
              id="smp-analyst"
              list="smp-analyst-list"
              required
              placeholder="Örn: Uzm. Lab. Aylin Korkmaz"
              value={form.analyst}
              onChange={(e) =>
                setForm((f) => ({ ...f, analyst: e.target.value }))
              }
            />
            <datalist id="smp-analyst-list">
              {analysts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Alınma Tarihi" htmlFor="smp-date">
            <Input
              id="smp-date"
              type="date"
              required
              value={form.receivedDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, receivedDate: e.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Sonuç"
            htmlFor="smp-result"
            hint="Onay/red için açıklama. Yeni kayıtta boş bırakılabilir."
          >
            <Textarea
              id="smp-result"
              placeholder="Örn: Spesifikasyon dahilinde"
              value={form.result}
              onChange={(e) =>
                setForm((f) => ({ ...f, result: e.target.value }))
              }
            />
          </FormField>
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
            Numuneyi Kaydet
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
