"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
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
import {
  rawMaterialOrderSourceLabels,
  type RawMaterialOrder,
  type RawMaterialOrderSource,
} from "@/data/raw-material-orders";
import type { RawMaterial } from "@/data/raw-materials";
import { WAREHOUSE_IDS, type Warehouse } from "@/data/warehouses";
import { fetchSuppliers } from "@/lib/catalog-store";
import { getWarehouses } from "@/lib/warehouse-store";
import { formatNumber, plusDaysIso, selectItemValues, todayIso } from "@/lib/utils";
import {
  getAllRawMaterials,
  RAW_MATERIAL_UNITS,
} from "@/lib/raw-material-store";
import { createManualRawMaterialOrder } from "@/lib/raw-material-order-store";

const SOURCE_OPTIONS: RawMaterialOrderSource[] = [
  "manual",
  "production_need",
  "low_stock",
];

const MATERIAL_PICKER_LIMIT = 40;

let cachedMaterials: RawMaterial[] | null = null;
let cachedWarehouses: Warehouse[] | null = null;
let lookupPromise: Promise<void> | null = null;

async function loadFormLookups() {
  if (cachedMaterials && cachedWarehouses) {
    return { materials: cachedMaterials, warehouses: cachedWarehouses };
  }
  if (!lookupPromise) {
    lookupPromise = Promise.all([getAllRawMaterials(), getWarehouses()]).then(
      ([materials, warehouses]) => {
        cachedMaterials = materials;
        cachedWarehouses = warehouses;
      }
    );
  }
  await lookupPromise;
  return {
    materials: cachedMaterials ?? [],
    warehouses: cachedWarehouses ?? [],
  };
}

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
  supplierHints?: string[];
  onCreated?: (order: RawMaterialOrder) => void;
}

export function RawMaterialOrderFormSheet({
  open,
  onOpenChange,
  supplierHints = [],
  onCreated,
}: RawMaterialOrderFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const supplierOptions = useMemo(() => {
    const base = selectItemValues(suppliers);
    const current = form.supplier.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.supplier, suppliers]);

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLocaleLowerCase("tr");
    const pool = q
      ? materials.filter(
          (m) =>
            m.name.toLocaleLowerCase("tr").includes(q) ||
            m.sku.toLocaleLowerCase("tr").includes(q)
        )
      : materials;
    return pool.slice(0, MATERIAL_PICKER_LIMIT);
  }, [materialQuery, materials]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setLoading(true);
    setForm(emptyForm());
    setMaterialQuery("");
    setMaterialPickerOpen(false);

    void (async () => {
      try {
        const [{ materials: materialList, warehouses: whList }, catalogSuppliers] =
          await Promise.all([loadFormLookups(), fetchSuppliers()]);
        setWarehouses(whList);
        setMaterials(materialList);
        setSuppliers(
          selectItemValues([
            ...catalogSuppliers.map((s) => s.name),
            ...supplierHints,
          ]).sort((a, b) => a.localeCompare(b, "tr"))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [open, supplierHints]);

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
      setMaterialQuery("");
      setMaterialPickerOpen(false);
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
    setMaterialQuery(`${m.name} (${m.sku})`);
    setMaterialPickerOpen(false);
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

    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Truck}
      title="Manuel talep"
      description="Sipariş numarası ve tutar otomatik hesaplanır. Kayıt Sipariş Verilecek durumunda açılır."
      className="max-w-2xl"
    >
      {open ? (
        <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
          <FormSheetBody className="space-y-5">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Form hazırlanıyor…
              </p>
            ) : (
              <>
                <FormSection
                  title="Hammadde"
                  description="Katalogdan seçince ad, SKU, birim ve birim fiyat dolar."
                >
                  <FormField label="Katalogdan seç" optional>
                    <div className="relative">
                      <Input
                        className="bg-white"
                        placeholder="Malzeme adı veya SKU ara…"
                        value={materialQuery}
                        onChange={(e) => {
                          setMaterialQuery(e.target.value);
                          setMaterialPickerOpen(true);
                          if (!e.target.value.trim()) {
                            applyCatalog("__new");
                          }
                        }}
                        onFocus={() => setMaterialPickerOpen(true)}
                        onBlur={() => {
                          window.setTimeout(() => setMaterialPickerOpen(false), 120);
                        }}
                      />
                      {materialPickerOpen ? (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyCatalog("__new")}
                          >
                            Yeni / serbest giriş
                          </button>
                          {filteredMaterials.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => applyCatalog(m.id)}
                            >
                              <span className="truncate">{m.name}</span>
                              <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                                {m.sku}
                              </span>
                            </button>
                          ))}
                          {!materialQuery.trim() && materials.length > MATERIAL_PICKER_LIMIT ? (
                            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                              İlk {MATERIAL_PICKER_LIMIT} kayıt gösteriliyor — arama yapın.
                            </p>
                          ) : null}
                          {materialQuery.trim() && filteredMaterials.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">
                              Sonuç yok — serbest giriş kullanın.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </FormField>
                  <FormField label="Hammadde adı" htmlFor="rmo-name" required>
                    <Input
                      id="rmo-name"
                      required
                      className="bg-white"
                      placeholder="Örn: Sarı Kantaron Ekstresi"
                      value={form.materialName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, materialName: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="SKU" htmlFor="rmo-sku" required>
                    <Input
                      id="rmo-sku"
                      required
                      className="bg-white font-mono"
                      placeholder="Örn: RM-API-SK"
                      value={form.sku}
                      onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    />
                  </FormField>
                </FormSection>

                <FormSection title="Tedarik ve miktar">
                  <FormField label="Tedarikçi" htmlFor="rmo-supplier" required>
                    <Input
                      id="rmo-supplier"
                      required
                      className="bg-white"
                      list="rmo-supplier-options"
                      placeholder="Tedarikçi adı yazın veya listeden seçin"
                      value={form.supplier}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, supplier: e.target.value }))
                      }
                    />
                    {supplierOptions.length > 0 ? (
                      <datalist id="rmo-supplier-options">
                        {supplierOptions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    ) : null}
                  </FormField>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Miktar" htmlFor="rmo-qty" required>
                      <Input
                        id="rmo-qty"
                        type="number"
                        required
                        min={0}
                        step="any"
                        className="bg-white"
                        placeholder="25"
                        value={form.quantity}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, quantity: e.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="Birim" required>
                      <Select
                        value={form.unit}
                        onValueChange={(unit) => setForm((f) => ({ ...f, unit }))}
                      >
                        <SelectTrigger className="bg-white">
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
                          ) && form.unit.trim() ? (
                            <SelectItem value={form.unit.trim()}>
                              {form.unit.trim()}
                            </SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    </FormField>
                  </div>
                  <FormField
                    label="Birim fiyat"
                    htmlFor="rmo-price"
                    required
                    hint={
                      previewTotal !== null
                        ? `Tutar (otomatik): ₺${formatNumber(previewTotal)}`
                        : "Tablodaki Tutar = miktar × birim fiyat."
                    }
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                        ₺
                      </span>
                      <Input
                        id="rmo-price"
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        className="bg-white pl-8"
                        placeholder="18500"
                        value={form.unitPrice}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, unitPrice: e.target.value }))
                        }
                      />
                    </div>
                  </FormField>
                </FormSection>

                <FormSection title="Planlama">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Kaynak" required>
                      <Select
                        value={form.source}
                        onValueChange={(source) =>
                          setForm((f) => ({
                            ...f,
                            source: source as RawMaterialOrderSource,
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
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
                    <FormField label="Hedef depo" required>
                      <Select
                        value={form.targetWarehouseId}
                        onValueChange={(targetWarehouseId) =>
                          setForm((f) => ({ ...f, targetWarehouseId }))
                        }
                      >
                        <SelectTrigger className="bg-white">
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Sipariş tarihi" htmlFor="rmo-date" required>
                      <Input
                        id="rmo-date"
                        type="date"
                        required
                        className="bg-white"
                        value={form.orderDate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, orderDate: e.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="Beklenen teslimat" htmlFor="rmo-eta" optional>
                      <Input
                        id="rmo-eta"
                        type="date"
                        className="bg-white"
                        value={form.expectedDelivery}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, expectedDelivery: e.target.value }))
                        }
                      />
                    </FormField>
                  </div>
                  <FormField label="Talep notu" htmlFor="rmo-note" optional>
                    <Textarea
                      id="rmo-note"
                      className="bg-white"
                      placeholder="Örn: Yeni formülasyon için üretim planı ihtiyacı"
                      value={form.sourceNote}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sourceNote: e.target.value }))
                      }
                    />
                  </FormField>
                </FormSection>
              </>
            )}
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
              disabled={saving || loading}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
            >
              {saving ? "Kaydediliyor…" : "Talebi oluştur"}
            </Button>
          </FormSheetFooter>
        </form>
      ) : null}
    </FormDialog>
  );
}
