"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TestTube } from "lucide-react";
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
import { selectItemValues, todayIso } from "@/lib/utils";

function emptyForm() {
  return {
    sampleNo: "",
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
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([...SAMPLE_TYPES]);
  const [analysts, setAnalysts] = useState<string[]>([]);

  const productOptions = useMemo(() => {
    const base = selectItemValues(products);
    const current = form.product.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.product, products]);

  const batchOptions = useMemo(() => {
    const base = selectItemValues(batches);
    const current = form.batchNo.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.batchNo, batches]);

  const analystOptions = useMemo(() => {
    const base = selectItemValues(analysts);
    const current = form.analyst.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.analyst, analysts]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm());
    void (async () => {
      const [batchList, orderProducts, sampleNo] = await Promise.all([
        getAllProductionBatches(),
        getOrderProducts(),
        nextSampleNo(),
      ]);
      setBatches(selectItemValues(batchList.map((b) => b.batchNo)));
      setProducts(
        selectItemValues(
          [...new Set([...orderProducts, ...batchList.map((b) => b.product)])]
        ).sort((a, b) => a.localeCompare(b, "tr"))
      );
      const [typeList, analystList] = await Promise.all([
        getSampleTypes(),
        getLabAnalysts(),
      ]);
      setTypes(selectItemValues(typeList));
      setAnalysts(selectItemValues(analystList));
      setForm((f) => ({ ...f, sampleNo }));
    })();
  }, [open]);

  function applyBatch(batchNo: string) {
    void getAllProductionBatches().then((batchList) => {
      const match = batchList.find((b) => b.batchNo === batchNo);
      setForm((f) => ({
        ...f,
        batchNo,
        product: match?.product ?? f.product,
      }));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product.trim() || !form.batchNo.trim() || !form.analyst.trim()) {
      toast.error("Ürün, batch ve analist zorunludur");
      return;
    }

    setSaving(true);
    try {
      const created = await createLabSample({
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={TestTube}
      title="Numune kaydı"
      description="Numune no otomatik üretilir. Batch seçilince ürün dolar."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Numune kimliği">
            <FormField label="Numune no" htmlFor="smp-no" required>
              <Input
                id="smp-no"
                required
                className="bg-white font-mono"
                value={form.sampleNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sampleNo: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Batch" required hint="Üretimdeki batch numaraları.">
              {batchOptions.length > 0 ? (
                <Select
                  value={form.batchNo || undefined}
                  onValueChange={applyBatch}
                >
                  <SelectTrigger className="bg-white font-mono">
                    <SelectValue placeholder="Batch seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {batchOptions.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  required
                  className="bg-white font-mono"
                  placeholder="Örn: BT-2026-0847"
                  value={form.batchNo}
                  onChange={(e) => applyBatch(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Ürün" htmlFor="smp-product" required>
              {productOptions.length > 0 ? (
                <Select
                  value={form.product || undefined}
                  onValueChange={(product) => setForm((f) => ({ ...f, product }))}
                >
                  <SelectTrigger id="smp-product" className="bg-white">
                    <SelectValue placeholder="Ürün seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="smp-product"
                  required
                  className="bg-white"
                  placeholder="Örn: Hepanorm 30 Tablet"
                  value={form.product}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, product: e.target.value }))
                  }
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="Analiz">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Tip" required>
                <Select
                  value={form.type}
                  onValueChange={(type) => setForm((f) => ({ ...f, type }))}
                >
                  <SelectTrigger className="bg-white">
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
              <FormField label="Durum" required>
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    setForm((f) => ({
                      ...f,
                      status: status as LabSample["status"],
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
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
            <FormField label="Analist" htmlFor="smp-analyst" required>
              {analystOptions.length > 0 ? (
                <Select
                  value={form.analyst || undefined}
                  onValueChange={(analyst) => setForm((f) => ({ ...f, analyst }))}
                >
                  <SelectTrigger id="smp-analyst" className="bg-white">
                    <SelectValue placeholder="Analist seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {analystOptions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="smp-analyst"
                  required
                  className="bg-white"
                  placeholder="Örn: BEYZANUR EKEN"
                  value={form.analyst}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, analyst: e.target.value }))
                  }
                />
              )}
            </FormField>
            <FormField label="Alınma tarihi" htmlFor="smp-date" required>
              <Input
                id="smp-date"
                type="date"
                required
                className="bg-white"
                value={form.receivedDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, receivedDate: e.target.value }))
                }
              />
            </FormField>
            <FormField
              label="Sonuç"
              htmlFor="smp-result"
              optional
              hint="Onay/red için açıklama. Yeni kayıtta boş bırakılabilir."
            >
              <Textarea
                id="smp-result"
                className="bg-white"
                placeholder="Örn: Spesifikasyon dahilinde"
                value={form.result}
                onChange={(e) =>
                  setForm((f) => ({ ...f, result: e.target.value }))
                }
              />
            </FormField>
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
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            {saving ? "Kaydediliyor…" : "Numuneyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
