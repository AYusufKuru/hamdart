"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  rawMaterialOrderSourceLabels,
  type RawMaterialOrder,
  type RawMaterialOrderSource,
} from "@/data/raw-material-orders";
import { WAREHOUSE_IDS, type Warehouse } from "@/data/warehouses";
import { getWarehouses } from "@/lib/warehouse-store";
import { formatNumber, plusDaysIso, todayIso } from "@/lib/utils";
import {
  getAllRawMaterials,
  RAW_MATERIAL_UNITS,
} from "@/lib/raw-material-store";
import {
  createManualRawMaterialOrder,
  getAllRawMaterialOrders,
} from "@/lib/raw-material-order-store";

const SOURCE_OPTIONS: RawMaterialOrderSource[] = [
  "manual",
  "production_need",
  "low_stock",
];

function emptyForm() {
  return {
    catalogId: "__new",
    materialName: "",
    sku: "",
    supplier: "",
    quantity: "",
    unit: "kg",
    unitPrice: "",
    source: "manual" as RawMaterialOrderSource,
    sourceNote: "",
    targetWarehouseId: WAREHOUSE_IDS.production as string,
    orderDate: todayIso(),
    expectedDelivery: plusDaysIso(14),
  };
}

interface RawMaterialOrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (order: RawMaterialOrder) => void;
}

export function RawMaterialOrderFormSheet({
  open,
  onOpenChange,
  onCreated,
}: RawMaterialOrderFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<
    Awaited<ReturnType<typeof getAllRawMaterials>>
  >([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    void (async () => {
      const [materialList, orders, whList] = await Promise.all([
        getAllRawMaterials(),
        getAllRawMaterialOrders(),
        getWarehouses(),
      ]);
      setWarehouses(whList);
      setMaterials(materialList);
      setSuppliers(
        [...new Set(orders.map((o) => o.supplier))].sort((a, b) =>
          a.localeCompare(b, "tr")
        )
      );
    })();
  }, [open]);

  const previewTotal = useMemo(() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return qty * price;
  }, [form.quantity, form.unitPrice]);

  function applyCatalog(id: string) {
    if (id === "__new") {
      setForm((f) => ({
        ...f,
        catalogId: "__new",
        materialName: "",
        sku: "",
        unit: "kg",
        unitPrice: "",
      }));
      return;
    }
    const m = materials.find((x) => x.id === id);
    if (!m) return;
    setForm((f) => ({
      ...f,
      catalogId: id,
      materialName: m.name,
      sku: m.sku,
      unit: m.unit,
      unitPrice: String(m.unitCost),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const unitPrice = parseFloat(form.unitPrice);
    if (!form.materialName.trim() || !form.sku.trim() || !form.supplier.trim()) {
      toast.error("Hammadde, SKU ve tedarikçi zorunludur");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error("Birim fiyat geçerli bir sayı olmalıdır");
      return;
    }
    if (form.expectedDelivery && form.expectedDelivery < form.orderDate) {
      toast.error("Beklenen teslimat sipariş tarihinden önce olamaz");
      return;
    }

    try {
      const created = await createManualRawMaterialOrder({
        materialName: form.materialName.trim(),
        sku: form.sku.trim(),
        supplier: form.supplier.trim(),
        quantity,
        unit: form.unit,
        unitPrice,
        source: form.source,
        sourceNote: form.sourceNote.trim() || undefined,
        targetWarehouseId: form.targetWarehouseId,
        orderDate: form.orderDate,
        expectedDelivery: form.expectedDelivery || undefined,
      });

      toast.success(`${created.orderNo} — Sipariş Verilecek listesine düştü`);
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Talep kaydedilemedi");
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Manuel Talep"
      description="Sipariş numarası ve tutar otomatik hesaplanır. Kayıt Sipariş Verilecek durumunda açılır; KK ve lot alanları teslimattan sonra doldurulur."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField
            label="Katalogdan seç"
            hint="Hammadde tablosundan seçince ad, SKU, birim ve birim fiyat dolar. Yeni malzeme için boş bırakın."
          >
            <Select value={form.catalogId} onValueChange={applyCatalog}>
              <SelectTrigger>
                <SelectValue placeholder="Malzeme seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new">Yeni / serbest giriş</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Hammadde" htmlFor="rmo-name">
            <Input
              id="rmo-name"
              required
              placeholder="Örn: Sarı Kantaron Ekstresi"
              value={form.materialName}
              onChange={(e) =>
                setForm((f) => ({ ...f, materialName: e.target.value }))
              }
            />
          </FormField>

          <FormField label="SKU" htmlFor="rmo-sku">
            <Input
              id="rmo-sku"
              required
              className="font-mono"
              placeholder="Örn: RM-API-SK"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            />
          </FormField>

          <FormField
            label="Tedarikçi"
            htmlFor="rmo-supplier"
            hint="Tablodaki Tedarikçi sütunu."
          >
            <Input
              id="rmo-supplier"
              list="rmo-supplier-list"
              required
              placeholder="Örn: ChemPure Global"
              value={form.supplier}
              onChange={(e) =>
                setForm((f) => ({ ...f, supplier: e.target.value }))
              }
            />
            <datalist id="rmo-supplier-list">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Miktar" htmlFor="rmo-qty">
              <Input
                id="rmo-qty"
                type="number"
                required
                min={0}
                step="any"
                placeholder="25"
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
                  {RAW_MATERIAL_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                  {!RAW_MATERIAL_UNITS.includes(
                    form.unit as (typeof RAW_MATERIAL_UNITS)[number]
                  ) && form.unit ? (
                    <SelectItem value={form.unit}>{form.unit}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Birim Fiyat (₺)"
            htmlFor="rmo-price"
            hint={
              previewTotal !== null
                ? `Tutar (otomatik): ₺${formatNumber(previewTotal)}`
                : "Tablodaki Tutar = miktar × birim fiyat."
            }
          >
            <Input
              id="rmo-price"
              type="number"
              required
              min={0}
              step="0.01"
              placeholder="18500"
              value={form.unitPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, unitPrice: e.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Kaynak"
            hint="Stok uyarısı genelde otomatik oluşur; üretim ihtiyacı planlamadan gelir."
          >
            <Select
              value={form.source}
              onValueChange={(source) =>
                setForm((f) => ({
                  ...f,
                  source: source as RawMaterialOrderSource,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {rawMaterialOrderSourceLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Hedef Depo"
            hint="Detay sayfasındaki Kalite & Depo kartı."
          >
            <Select
              value={form.targetWarehouseId}
              onValueChange={(targetWarehouseId) =>
                setForm((f) => ({ ...f, targetWarehouseId }))
              }
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sipariş Tarihi" htmlFor="rmo-date">
              <Input
                id="rmo-date"
                type="date"
                required
                value={form.orderDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, orderDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Beklenen Teslimat" htmlFor="rmo-eta">
              <Input
                id="rmo-eta"
                type="date"
                value={form.expectedDelivery}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expectedDelivery: e.target.value }))
                }
              />
            </FormField>
          </div>

          <FormField
            label="Talep notu"
            htmlFor="rmo-note"
            hint="Tablodaki Kaynak altındaki açıklama ve detaydaki talep notu."
          >
            <Textarea
              id="rmo-note"
              placeholder="Örn: Yeni formülasyon için üretim planı ihtiyacı"
              value={form.sourceNote}
              onChange={(e) =>
                setForm((f) => ({ ...f, sourceNote: e.target.value }))
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
            Talebi Oluştur
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
