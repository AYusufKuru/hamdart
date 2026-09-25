"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
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
import type { RawMaterialOrder } from "@/data/raw-material-orders";
import type { RawMaterial } from "@/data/raw-materials";
import { WAREHOUSE_IDS } from "@/data/warehouses";
import {
  getAllRawMaterials,
  RAW_MATERIAL_UNITS,
} from "@/lib/raw-material-store";
import { createManualRawMaterialOrder } from "@/lib/raw-material-order-store";

const UNASSIGNED_SUPPLIER = "— Tedarikçi atanacak";
const MATERIAL_PICKER_LIMIT = 40;

let cachedMaterials: RawMaterial[] | null = null;
let lookupPromise: Promise<void> | null = null;

async function loadMaterials() {
  if (cachedMaterials) return cachedMaterials;
  if (!lookupPromise) {
    lookupPromise = getAllRawMaterials().then((materials) => {
      cachedMaterials = materials;
    });
  }
  await lookupPromise;
  return cachedMaterials ?? [];
}

function emptyForm() {
  return {
    catalogId: "__new",
    materialName: "",
    sku: "",
    quantity: "",
    unit: "kg",
  };
}

interface RawMaterialOrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSupplier?: string;
  lockSupplier?: boolean;
  onCreated?: (order: RawMaterialOrder) => void;
}

export function RawMaterialOrderFormSheet({
  open,
  onOpenChange,
  defaultSupplier = "",
  lockSupplier = false,
  onCreated,
}: RawMaterialOrderFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

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
        setMaterials(await loadMaterials());
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  function applyCatalog(id: string) {
    if (id === "__new") {
      setForm((f) => ({
        ...f,
        catalogId: "__new",
        materialName: "",
        sku: "",
        unit: "kg",
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
    }));
    setMaterialQuery(`${m.name} (${m.sku})`);
    setMaterialPickerOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    if (!form.materialName.trim() || !form.sku.trim()) {
      toast.error("Hammadde ve SKU zorunludur");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }

    setSaving(true);
    try {
      const created = await createManualRawMaterialOrder({
        materialName: form.materialName.trim(),
        sku: form.sku.trim(),
        supplier: (lockSupplier ? defaultSupplier.trim() : "") || UNASSIGNED_SUPPLIER,
        quantity,
        unit: form.unit,
        unitPrice: 0,
        source: "manual",
        targetWarehouseId: WAREHOUSE_IDS.production,
      });

      toast.success(`${created.orderNo} oluşturuldu. Alım bilgisi detayda girilecek.`);
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
      description="Depo ürün ve miktarı yazar. Tedarikçi, fiyat ve planlama talep detayında girilir."
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
                  description="Katalogdan seçince ad, SKU ve birim dolar."
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
