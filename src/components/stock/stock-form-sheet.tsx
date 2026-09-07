"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { WAREHOUSE_IDS, type Warehouse } from "@/data/warehouses";
import { getWarehouses } from "@/lib/warehouse-store";
import type { StockStatus } from "@/data/mock";
import { plusYearsIso } from "@/lib/utils";
import {
  createStockEntry,
  deriveStockStatus,
  getKnownCategories,
  getKnownSkus,
  getKnownStockNames,
  getKnownUnits,
  STOCK_CATEGORIES,
  STOCK_UNITS,
} from "@/lib/stock-store";

const STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "low", label: "Düşük" },
  { value: "critical", label: "Kritik" },
  { value: "expiring", label: "SKT Yakın" },
];

const TEMPERATURE_OPTIONS = ["", "2-8°C", "15-25°C", "-20°C"] as const;

type LabEntryMode = "none" | "direct" | "replenish";

function defaultLotNo() {
  return `LOT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}

function emptyForm(warehouseId?: string) {
  const defaultWh = warehouseId || WAREHOUSE_IDS.production;
  return {
    sku: "",
    name: "",
    category: "Ham Madde",
    warehouseId: defaultWh as string,
    quantity: "",
    unit: "kg",
    minStock: "",
    lotNo: defaultLotNo(),
    expiryDate: plusYearsIso(2),
    status: "normal" as StockStatus,
    temperature: "",
    labEntry: "replenish" as LabEntryMode,
    labTargetQuantity: "",
    replenishFromWarehouseId: WAREHOUSE_IDS.production as string,
  };
}

interface StockFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  defaultWarehouseId?: string;
}

export function StockFormSheet({
  open,
  onOpenChange,
  onCreated,
  defaultWarehouseId,
}: StockFormSheetProps) {
  const router = useRouter();
  const [form, setForm] = useState(() => emptyForm(defaultWarehouseId));
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [skus, setSkus] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([...STOCK_CATEGORIES]);
  const [units, setUnits] = useState<string[]>([...STOCK_UNITS]);

  const selectedWarehouse = warehouses.find((w) => w.id === form.warehouseId);
  const isLab = selectedWarehouse?.type === "laboratory";

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultWarehouseId));
    void (async () => {
      const [skuList, nameList, catList, unitList, whList] = await Promise.all([
        getKnownSkus(),
        getKnownStockNames(),
        getKnownCategories(),
        getKnownUnits(),
        getWarehouses(),
      ]);
      setSkus(skuList);
      setNames(nameList);
      setCategories(catList);
      setUnits(unitList);
      setWarehouses(whList);
    })();
  }, [open, defaultWarehouseId]);

  function patch<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      const qty = parseFloat(next.quantity);
      const min = parseFloat(next.minStock);
      if (
        Number.isFinite(qty) &&
        Number.isFinite(min) &&
        next.expiryDate &&
        (key === "quantity" || key === "minStock" || key === "expiryDate")
      ) {
        next.status = deriveStockStatus(qty, min, next.expiryDate);
      }
      if (key === "warehouseId") {
        const wh = warehouses.find((w) => w.id === value);
        if (wh?.type !== "laboratory") {
          next.labEntry = "none";
        } else if (next.labEntry === "none") {
          next.labEntry = "replenish";
        }
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const minStock = parseFloat(form.minStock);
    if (!form.sku.trim() || !form.name.trim() || !form.lotNo.trim()) {
      toast.error("SKU, ürün adı ve lot no zorunludur");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Miktar 0 veya daha büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(minStock) || minStock < 0) {
      toast.error("Minimum stok 0 veya daha büyük olmalıdır");
      return;
    }

    const labDirectEntry = isLab && form.labEntry === "direct";
    const replenishFromWarehouseId =
      isLab && form.labEntry === "replenish"
        ? form.replenishFromWarehouseId
        : undefined;
    const labTargetRaw = parseFloat(form.labTargetQuantity);
    const labTargetQuantity =
      isLab && form.labEntry === "replenish" && Number.isFinite(labTargetRaw)
        ? labTargetRaw
        : undefined;

    try {
      const created = await createStockEntry({
        sku: form.sku,
        name: form.name,
        category: form.category,
        warehouseId: form.warehouseId,
        quantity,
        unit: form.unit,
        minStock,
        lotNo: form.lotNo,
        expiryDate: form.expiryDate,
        status: form.status,
        temperature: form.temperature || undefined,
        labDirectEntry: labDirectEntry || undefined,
        replenishFromWarehouseId,
        labTargetQuantity,
      });

      toast.success(`${created.sku} stoğa eklendi`, {
        action: {
          label: "Depoyu aç",
          onClick: () => router.push(`/warehouses/${created.warehouseId}`),
        },
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stok kaydedilemedi");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stok Girişi"
      description="Kalem, stok tablosu ve depo detayındaki sütunlarla kaydedilir. Durum miktar, min stok ve SKT’ye göre önerilir."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField
            label="SKU"
            htmlFor="stock-sku"
            hint="Aynı SKU farklı depolarda olabilir (ör. üretim + lab numune)."
          >
            <Input
              id="stock-sku"
              list="stock-sku-list"
              required
              className="font-mono"
              placeholder="Örn: 152.01.06.00018"
              value={form.sku}
              onChange={(e) => patch("sku", e.target.value)}
            />
            <datalist id="stock-sku-list">
              {skus.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Ürün" htmlFor="stock-name">
            <Input
              id="stock-name"
              list="stock-name-list"
              required
              placeholder="Örn: MAXİLİV MAGNİFUL 5X 60 TABLET"
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
            />
            <datalist id="stock-name-list">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Kategori">
              <Select
                value={form.category}
                onValueChange={(category) => patch("category", category)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Depo"
              hint="Tablodaki Depo sütunu ve depo detay listesi."
            >
              <Select
                value={form.warehouseId}
                onValueChange={(warehouseId) => patch("warehouseId", warehouseId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Miktar" htmlFor="stock-qty">
              <Input
                id="stock-qty"
                type="number"
                required
                min={0}
                step="any"
                placeholder="450"
                value={form.quantity}
                onChange={(e) => patch("quantity", e.target.value)}
              />
            </FormField>
            <FormField label="Birim">
              <Select
                value={form.unit}
                onValueChange={(unit) => patch("unit", unit)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Minimum Stok"
            htmlFor="stock-min"
            hint="Tabloda miktarın altında Min: olarak görünür. Altına düşünce durum Düşük/Kritik olur."
          >
            <Input
              id="stock-min"
              type="number"
              required
              min={0}
              step="any"
              placeholder="200"
              value={form.minStock}
              onChange={(e) => patch("minStock", e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Lot No" htmlFor="stock-lot">
              <Input
                id="stock-lot"
                required
                className="font-mono"
                placeholder="LOT-2026-0845"
                value={form.lotNo}
                onChange={(e) => patch("lotNo", e.target.value)}
              />
            </FormField>
            <FormField label="Son Kullanma (SKT)" htmlFor="stock-expiry">
              <Input
                id="stock-expiry"
                type="date"
                required
                value={form.expiryDate}
                onChange={(e) => patch("expiryDate", e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Durum"
              hint="Miktar / min / SKT değişince otomatik önerilir."
            >
              <Select
                value={form.status}
                onValueChange={(status) =>
                  patch("status", status as StockStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Sıcaklık / Soğuk Zincir"
              hint="Doluysa tabloda kar tanesi ikonu çıkar."
            >
              <Select
                value={form.temperature || "__none"}
                onValueChange={(v) =>
                  patch("temperature", v === "__none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Yok" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Yok</SelectItem>
                  {TEMPERATURE_OPTIONS.filter(Boolean).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {isLab && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                Laboratuvar girişi
              </p>
              <FormField
                label="Kaynak"
                hint="Doğrudan lab: değerli/az miktar. Aktarım: üretim deposundan tamamlanır."
              >
                <Select
                  value={form.labEntry}
                  onValueChange={(labEntry) =>
                    patch("labEntry", labEntry as LabEntryMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Doğrudan lab</SelectItem>
                    <SelectItem value="replenish">
                      Ana depodan aktarım
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              {form.labEntry === "replenish" && (
                <>
                  <FormField label="Aktarım kaynağı">
                    <Select
                      value={form.replenishFromWarehouseId}
                      onValueChange={(replenishFromWarehouseId) =>
                        patch(
                          "replenishFromWarehouseId",
                          replenishFromWarehouseId
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses
                          .filter((w) => w.type !== "laboratory")
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label="Lab hedef miktar"
                    htmlFor="stock-lab-target"
                    hint="Depo detayında Hedef: olarak görünür."
                  >
                    <Input
                      id="stock-lab-target"
                      type="number"
                      min={0}
                      step="any"
                      placeholder="2"
                      value={form.labTargetQuantity}
                      onChange={(e) =>
                        patch("labTargetQuantity", e.target.value)
                      }
                    />
                  </FormField>
                </>
              )}
            </div>
          )}
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
            Stoğa Ekle
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
