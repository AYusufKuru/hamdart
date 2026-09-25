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
import type { Warehouse } from "@/data/warehouses";
import { fetchSuppliers } from "@/lib/catalog-store";
import { getWarehouses } from "@/lib/warehouse-store";
import { RAW_MATERIAL_UNITS } from "@/lib/raw-material-store";
import { updateRawMaterialPurchase } from "@/lib/raw-material-order-store";
import { formatNumber, selectItemValues } from "@/lib/utils";

const UNASSIGNED_SUPPLIER = "— Tedarikçi atanacak";
const SOURCE_OPTIONS: RawMaterialOrderSource[] = [
  "manual",
  "production_need",
  "low_stock",
];

function supplierValue(supplier: string) {
  const name = supplier.trim();
  if (!name || name === UNASSIGNED_SUPPLIER) return "";
  return name;
}

export function PurchaseDetailsForm({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: RawMaterialOrder;
  onSaved: (order: RawMaterialOrder) => void;
}) {
  const [supplier, setSupplier] = useState(supplierValue(order.supplier));
  const [quantity, setQuantity] = useState(String(order.quantity));
  const [unit, setUnit] = useState(order.unit);
  const [unitPrice, setUnitPrice] = useState(
    order.unitPrice > 0 ? String(order.unitPrice) : ""
  );
  const [source, setSource] = useState<RawMaterialOrderSource>(order.source);
  const [targetWarehouseId, setTargetWarehouseId] = useState(order.targetWarehouseId);
  const [orderDate, setOrderDate] = useState(order.orderDate);
  const [expectedDelivery, setExpectedDelivery] = useState(order.expectedDelivery ?? "");
  const [sourceNote, setSourceNote] = useState(order.sourceNote ?? "");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSupplier(supplierValue(order.supplier));
    setQuantity(String(order.quantity));
    setUnit(order.unit);
    setUnitPrice(order.unitPrice > 0 ? String(order.unitPrice) : "");
    setSource(order.source);
    setTargetWarehouseId(order.targetWarehouseId);
    setOrderDate(order.orderDate);
    setExpectedDelivery(order.expectedDelivery ?? "");
    setSourceNote(order.sourceNote ?? "");
  }, [order]);

  useEffect(() => {
    void Promise.all([
      getWarehouses().catch(() => [] as Warehouse[]),
      fetchSuppliers().catch(() => []),
    ]).then(([warehouseRows, supplierRows]) => {
      setWarehouses(warehouseRows);
      setSuppliers(supplierRows.map((row) => row.name));
    });
  }, []);

  const supplierOptions = useMemo(() => {
    const base = selectItemValues(suppliers);
    const current = supplier.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [supplier, suppliers]);

  const previewTotal = useMemo(() => {
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    return qty * price;
  }, [quantity, unitPrice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const price = parseFloat(unitPrice);
    if (!supplier.trim()) {
      toast.error("Tedarikçi zorunludur");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Birim fiyat geçerli bir sayı olmalıdır");
      return;
    }
    if (expectedDelivery && expectedDelivery < orderDate) {
      toast.error("Beklenen teslimat sipariş tarihinden önce olamaz");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateRawMaterialPurchase({
        id: order.id,
        supplier: supplier.trim(),
        quantity: qty,
        unit,
        unitPrice: price,
        source,
        sourceNote: sourceNote.trim() || null,
        targetWarehouseId,
        orderDate,
        expectedDelivery: expectedDelivery || null,
      });
      onSaved(updated);
      onOpenChange(false);
      toast.success("Alım bilgisi kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Alım bilgisi kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Truck}
      title="Alım"
      description="Depo talebi açtı. Tedarikçi, fiyat ve planlamayı burada girin."
      className="max-w-2xl"
    >
      {open ? (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <FormSheetBody className="space-y-5">
          <FormSection title="Tedarik ve miktar">
            <FormField label="Tedarikçi" htmlFor="purchase-supplier" required>
              <Input
                id="purchase-supplier"
                required
                className="bg-white"
                list="purchase-supplier-options"
                placeholder="Tedarikçi adı yazın veya listeden seçin"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
              {supplierOptions.length > 0 ? (
                <datalist id="purchase-supplier-options">
                  {supplierOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Miktar" htmlFor="purchase-qty" required>
                <Input
                  id="purchase-qty"
                  type="number"
                  required
                  min={0}
                  step="any"
                  className="bg-white"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </FormField>
              <FormField label="Birim" required>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAW_MATERIAL_UNITS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                    {!RAW_MATERIAL_UNITS.includes(unit as (typeof RAW_MATERIAL_UNITS)[number]) &&
                    unit.trim() ? (
                      <SelectItem value={unit.trim()}>{unit.trim()}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField
              label="Birim fiyat"
              htmlFor="purchase-price"
              required
              hint={
                previewTotal !== null
                  ? `Tutar: ₺${formatNumber(previewTotal)}`
                  : "Tutar = miktar × birim fiyat."
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="purchase-price"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  className="bg-white pl-8"
                  placeholder="18500"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            </FormField>
          </FormSection>

          <FormSection title="Planlama">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Kaynak" required>
                <Select
                  value={source}
                  onValueChange={(value) => setSource(value as RawMaterialOrderSource)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(SOURCE_OPTIONS.includes(source)
                      ? SOURCE_OPTIONS
                      : [source, ...SOURCE_OPTIONS]
                    ).map((item) => (
                      <SelectItem key={item} value={item}>
                        {rawMaterialOrderSourceLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Hedef depo" required>
                <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Sipariş tarihi" htmlFor="purchase-date" required>
                <Input
                  id="purchase-date"
                  type="date"
                  required
                  className="bg-white"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </FormField>
              <FormField label="Beklenen teslimat" htmlFor="purchase-eta" optional>
                <Input
                  id="purchase-eta"
                  type="date"
                  className="bg-white"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Talep notu" htmlFor="purchase-note" optional>
              <Textarea
                id="purchase-note"
                className="bg-white"
                placeholder="Örn: Yeni formülasyon için üretim planı ihtiyacı"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
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
              {saving ? "Kaydediliyor…" : "Alımı kaydet"}
            </Button>
          </FormSheetFooter>
        </form>
      ) : null}
    </FormDialog>
  );
}
