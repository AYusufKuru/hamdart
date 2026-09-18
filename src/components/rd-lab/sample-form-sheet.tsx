"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TestTube } from "lucide-react";
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
import type { LabSampleSourceKind } from "@/data/mock";
import {
  createLabSample,
  getLabPeople,
  nextSampleNo,
} from "@/lib/lab-store";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { getWarehouseName } from "@/data/warehouses";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber, selectItemValues, todayIso } from "@/lib/utils";
import { PersonField } from "@/components/rd-lab/person-field";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { WarehouseStockItem } from "@/data/warehouses";

function isMamul(item: WarehouseStockItem) {
  return item.category.trim().toLocaleLowerCase("tr").replace(/[İIıi]/g, "i") ===
    "mamul";
}

function emptyForm() {
  return {
    sampleNo: "",
    sourceKind: "product" as LabSampleSourceKind,
    stockItemId: "",
    quantity: "1",
    analyst: "",
    receivedDate: todayIso(),
  };
}

export function SampleFormSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [analysts, setAnalysts] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);
  const { canRead } = useAuth();

  const analystOptions = useMemo(
    () => selectItemValues(analysts),
    [analysts]
  );

  const stockOptions = useMemo(() => {
    return stockItems
      .filter((item) => item.quantity > 0)
      .filter((item) =>
        form.sourceKind === "product" ? isMamul(item) : !isMamul(item)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [stockItems, form.sourceKind]);

  const selected = stockOptions.find((item) => item.id === form.stockItemId);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm());
    void (async () => {
      const [sampleNo, stock, people] = await Promise.all([
        nextSampleNo(),
        ifAllowed(
          canRead("stock"),
          () => getAllWarehouseStockItems(),
          [] as WarehouseStockItem[]
        ),
        getLabPeople("analyst"),
      ]);
      setStockItems(stock);
      setAnalysts(selectItemValues(people));
      setForm((f) => ({ ...f, sampleNo }));
    })();
  }, [open, canRead]);

  function applyStock(stockItemId: string) {
    const item = stockOptions.find((s) => s.id === stockItemId);
    setForm((f) => ({
      ...f,
      stockItemId,
      quantity: item && (!f.quantity || f.quantity === "1") ? "1" : f.quantity,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.stockItemId || !form.analyst.trim()) {
      toast.error("Stok kalemi ve analist zorunludur");
      return;
    }
    const quantity = parseFloat(form.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Numune miktarını girin");
      return;
    }
    if (selected && quantity > selected.quantity) {
      toast.error(
        `En fazla ${formatNumber(selected.quantity)} ${selected.unit} alınabilir`
      );
      return;
    }

    setSaving(true);
    try {
      const created = await createLabSample({
        sampleNo: form.sampleNo,
        sourceKind: form.sourceKind,
        stockItemId: form.stockItemId,
        quantity,
        unit: selected?.unit,
        receivedDate: form.receivedDate,
        analyst: form.analyst,
        status: "testing",
      });
      toast.success(
        `${created.sampleNo} başlatıldı — stoktan ${formatNumber(quantity)} ${created.unit ?? ""} düşüldü`
      );
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
      description="Hammadde veya mamul seçin, miktarı alın; stoktan düşülür. Test bitince iade veya ıskarta edilir."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Kaynak">
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
            <FormField label="Kaynak türü" required>
              <Select
                value={form.sourceKind}
                onValueChange={(sourceKind) =>
                  setForm((f) => ({
                    ...f,
                    sourceKind: sourceKind as LabSampleSourceKind,
                    stockItemId: "",
                  }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Mamul ürün</SelectItem>
                  <SelectItem value="material">Hammadde</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label={form.sourceKind === "product" ? "Mamul stok" : "Hammadde stok"}
              required
              hint={
                form.sourceKind === "product"
                  ? "Üretilmiş mamul stoğundan numune alınır."
                  : "Depodaki hammaddeden numune alınır."
              }
            >
              {stockOptions.length > 0 ? (
                <SearchableSelect
                  value={form.stockItemId || undefined}
                  onValueChange={applyStock}
                  placeholder={
                    form.sourceKind === "product"
                      ? "Mamul seçin"
                      : "Hammadde seçin"
                  }
                  searchPlaceholder={
                    form.sourceKind === "product"
                      ? "Mamul ara…"
                      : "Hammadde ara…"
                  }
                  emptyText="Eşleşen stok kalemi yok"
                  options={stockOptions.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.lotNo} · ${getWarehouseName(item.warehouseId)} (${formatNumber(item.quantity)} ${item.unit})`,
                    keywords: `${item.name} ${item.lotNo} ${getWarehouseName(item.warehouseId)}`,
                  }))}
                />
              ) : (
                <p className="text-sm text-amber-700">
                  {form.sourceKind === "product"
                    ? "Mamul stoğunda numune alınacak ürün yok."
                    : "Hammadde stoğunda numune alınacak kalem yok."}
                </p>
              )}
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Alınacak miktar"
                htmlFor="smp-qty"
                required
                hint={
                  selected
                    ? `Stokta ${formatNumber(selected.quantity)} ${selected.unit}`
                    : "Test için stoktan düşülecek adet."
                }
              >
                <Input
                  id="smp-qty"
                  type="number"
                  min={0.0001}
                  step="any"
                  required
                  className="bg-white"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Birim">
                <Input
                  className="bg-white"
                  value={selected?.unit ?? ""}
                  readOnly
                  placeholder="Stok birimi"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Analiz">
            <PersonField
              id="smp-analyst"
              label="Analist"
              value={form.analyst}
              options={analystOptions}
              onChange={(analyst) => setForm((f) => ({ ...f, analyst }))}
              placeholder="Analist seçin"
              emptyHint="Analist departmanında çalışan yok. Personel ekranından ekleyin."
            />
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
            {saving ? "Kaydediliyor…" : "Numuneyi başlat"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
