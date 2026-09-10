"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
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
import { WAREHOUSE_IDS, type Warehouse } from "@/data/warehouses";
import { fetchCustomers } from "@/lib/catalog-store";
import { getWarehouses } from "@/lib/warehouse-store";
import { getAllRecipes } from "@/lib/recipe-store";
import type { Order, OrderStatus } from "@/data/mock";
import { plusDaysIso, selectItemValues, todayIso } from "@/lib/utils";
import {
  createOrder,
  getOrderCustomers,
  getOrderProducts,
} from "@/lib/order-store";

const UNITS = ["tablet", "kapsül", "şişe", "adet", "kalem"] as const;

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "Yüksek" },
  { value: "urgent", label: "Acil" },
] as const;

const STATUS_OPTIONS = [
  { value: "pending", label: "Bekliyor" },
  { value: "confirmed", label: "Onaylandı" },
  { value: "picking", label: "Toplanıyor" },
  { value: "shipped", label: "Sevk Edildi" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
] as const;

function emptyForm(warehouseName = "Fabrika") {
  return {
    customer: "",
    product: "",
    quantity: "",
    unit: "tablet",
    warehouse: warehouseName,
    priority: "normal" as const,
    status: "pending" as OrderStatus,
    orderDate: todayIso(),
    deliveryDate: plusDaysIso(7),
    value: "",
  };
}

interface OrderFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (order: Order) => void;
}

export function OrderFormSheet({
  open,
  onOpenChange,
  onCreated,
}: OrderFormSheetProps) {
  const [form, setForm] = useState(() => emptyForm());
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const customerOptions = useMemo(() => {
    const base = selectItemValues(customers);
    const current = form.customer.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.customer, customers]);

  const productOptions = useMemo(() => {
    const base = selectItemValues(products);
    const current = form.product.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.product, products]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void (async () => {
      const [customerList, orderCustomers, orderProducts, recipes, whList] =
        await Promise.all([
          fetchCustomers(),
          getOrderCustomers(),
          getOrderProducts(),
          getAllRecipes(),
          getWarehouses(),
        ]);
      setWarehouses(whList);
      const production =
        whList.find((w) => w.id === WAREHOUSE_IDS.production) ??
        whList.find((w) => w.type === "production") ??
        whList[0];
      setForm(emptyForm(production?.name ?? "Fabrika"));
      setCustomers(
        selectItemValues(
          [...new Set([...customerList.map((c) => c.name), ...orderCustomers])]
        ).sort((a, b) => a.localeCompare(b, "tr"))
      );
      setProducts(
        selectItemValues(
          [...new Set([...recipes.map((r) => r.productName), ...orderProducts])]
        ).sort((a, b) => a.localeCompare(b, "tr"))
      );
    })();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = parseFloat(form.quantity);
    const value = parseFloat(form.value);
    if (!form.customer.trim() || !form.product.trim()) {
      toast.error("Müşteri ve ürün zorunludur");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Fatura tutarı geçerli bir sayı olmalıdır");
      return;
    }
    if (form.deliveryDate < form.orderDate) {
      toast.error("Teslimat tarihi sipariş tarihinden önce olamaz");
      return;
    }

    setSaving(true);
    try {
      const created = await createOrder({
        customer: form.customer.trim(),
        product: form.product.trim(),
        quantity,
        unit: form.unit,
        warehouse: form.warehouse,
        priority: form.priority,
        status: form.status,
        orderDate: form.orderDate,
        deliveryDate: form.deliveryDate,
        value,
      });

      toast.success(`${created.orderNo} oluşturuldu`);
      onOpenChange(false);
      onCreated?.(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sipariş kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ShoppingCart}
      title="Yeni sipariş"
      description="Sipariş numarası otomatik üretilir. Reçete sipariş detayından oluşturulur."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Müşteri ve ürün"
            description="Ürün adı üretim reçetesiyle aynı olmalıdır."
          >
            <FormField label="Müşteri" htmlFor="order-customer" required>
              {customerOptions.length > 0 ? (
                <Select
                  value={form.customer || undefined}
                  onValueChange={(customer) => setForm((f) => ({ ...f, customer }))}
                >
                  <SelectTrigger id="order-customer" className="bg-white">
                    <SelectValue placeholder="Müşteri seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="order-customer"
                  required
                  className="bg-white"
                  placeholder="Örn: ALLIANCE HEALTHCARE ECZA DEPOSU A.Ş."
                  value={form.customer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customer: e.target.value }))
                  }
                />
              )}
            </FormField>
            <FormField label="Ürün" htmlFor="order-product" required>
              {productOptions.length > 0 ? (
                <Select
                  value={form.product || undefined}
                  onValueChange={(product) => setForm((f) => ({ ...f, product }))}
                >
                  <SelectTrigger id="order-product" className="bg-white">
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
                  id="order-product"
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Miktar" htmlFor="order-quantity" required>
                <Input
                  id="order-quantity"
                  type="number"
                  required
                  min={1}
                  step="any"
                  className="bg-white"
                  placeholder="50000"
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
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Sevkiyat ve durum">
            <FormField label="Depo" required hint="Sevkiyatın çıkacağı depo.">
              <Select
                value={form.warehouse}
                onValueChange={(warehouse) => setForm((f) => ({ ...f, warehouse }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Depo seçin" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((w) => w.name.trim())
                    .map((w) => (
                    <SelectItem key={w.id} value={w.name}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Öncelik" required>
                <Select
                  value={form.priority}
                  onValueChange={(priority) =>
                    setForm((f) => ({
                      ...f,
                      priority: priority as typeof form.priority,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Durum" required hint="Yeni sipariş genelde Bekliyor ile başlar.">
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    setForm((f) => ({ ...f, status: status as OrderStatus }))
                  }
                >
                  <SelectTrigger className="bg-white">
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
            </div>
          </FormSection>

          <FormSection title="Tarih ve tutar">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Sipariş tarihi" htmlFor="order-date" required>
                <Input
                  id="order-date"
                  type="date"
                  required
                  className="bg-white"
                  value={form.orderDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orderDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Teslimat tarihi" htmlFor="order-delivery" required>
                <Input
                  id="order-delivery"
                  type="date"
                  required
                  className="bg-white"
                  value={form.deliveryDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryDate: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField
              label="Fatura tutarı"
              htmlFor="order-value"
              required
              hint="Tablodaki Fatura sütunu ve reçete gelir hesabı bu tutarı kullanır."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="order-value"
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  className="bg-white pl-8"
                  placeholder="425000"
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                />
              </div>
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
            {saving ? "Kaydediliyor…" : "Siparişi oluştur"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
