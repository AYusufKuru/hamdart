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
import { warehouses } from "@/data/warehouses";
import type { Order, OrderStatus } from "@/data/mock";
import { plusDaysIso, todayIso } from "@/lib/utils";
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

function emptyForm() {
  const production =
    warehouses.find((w) => w.type === "production") ?? warehouses[0];
  return {
    customer: "",
    product: "",
    quantity: "",
    unit: "tablet",
    warehouse: production?.name ?? "",
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
  const [form, setForm] = useState(emptyForm);
  const [customers, setCustomers] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setCustomers(getOrderCustomers());
    setProducts(getOrderProducts());
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
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

    try {
      const created = createOrder({
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
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni Sipariş"
      description="Müşteri siparişi tablodaki alanlarla kaydedilir. Sipariş numarası otomatik üretilir; reçete sipariş detayından oluşturulur."
    >
      <form
        className="flex flex-1 flex-col min-h-0"
        noValidate
        onSubmit={handleSubmit}
      >
        <FormSheetBody>
          <FormField
            label="Müşteri"
            htmlFor="order-customer"
            hint="Mevcut müşterilerden seçebilir veya yeni yazabilirsiniz."
          >
            <Input
              id="order-customer"
              list="order-customer-list"
              required
              placeholder="Örn: MediCare Eczane Zinciri"
              value={form.customer}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer: e.target.value }))
              }
            />
            <datalist id="order-customer-list">
              {customers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FormField>

          <FormField
            label="Ürün"
            htmlFor="order-product"
            hint="Üretimdeki ürün adıyla aynı yazın; reçete ve maliyet bu isme bağlanır."
          >
            <Input
              id="order-product"
              list="order-product-list"
              required
              placeholder="Örn: CardioMax 50mg"
              value={form.product}
              onChange={(e) =>
                setForm((f) => ({ ...f, product: e.target.value }))
              }
            />
            <datalist id="order-product-list">
              {products.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Miktar" htmlFor="order-quantity">
              <Input
                id="order-quantity"
                type="number"
                required
                min={1}
                step="any"
                placeholder="50000"
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
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField
            label="Depo"
            hint="Sevkiyatın çıkacağı depo — tablodaki Depo sütunu."
          >
            <Select
              value={form.warehouse}
              onValueChange={(warehouse) =>
                setForm((f) => ({ ...f, warehouse }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Depo seçin" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Öncelik">
              <Select
                value={form.priority}
                onValueChange={(priority) =>
                  setForm((f) => ({
                    ...f,
                    priority: priority as typeof form.priority,
                  }))
                }
              >
                <SelectTrigger>
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
            <FormField
              label="Durum"
              hint="Yeni sipariş genelde Bekliyor ile başlar."
            >
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((f) => ({ ...f, status: status as OrderStatus }))
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sipariş Tarihi" htmlFor="order-date">
              <Input
                id="order-date"
                type="date"
                required
                value={form.orderDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, orderDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Teslimat Tarihi" htmlFor="order-delivery">
              <Input
                id="order-delivery"
                type="date"
                required
                value={form.deliveryDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deliveryDate: e.target.value }))
                }
              />
            </FormField>
          </div>

          <FormField
            label="Fatura Tutarı (₺)"
            htmlFor="order-value"
            hint="Tablodaki Fatura sütunu ve reçete gelir hesabı bu tutarı kullanır."
          >
            <Input
              id="order-value"
              type="number"
              required
              min={0}
              step="0.01"
              placeholder="425000"
              value={form.value}
              onChange={(e) =>
                setForm((f) => ({ ...f, value: e.target.value }))
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
            Siparişi Oluştur
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
