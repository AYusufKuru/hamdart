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
import { FormDialog, FormField } from "@/components/shared/form-sheet";
import type { Order } from "@/data/mock";
import type { Customer } from "@/data/catalog";
import { getWarehouseName, type WarehouseStockItem } from "@/data/warehouses";
import { fetchCustomers } from "@/lib/catalog-store";
import {
  createShipment,
  getOrderCustomers,
  updateOrderShipment,
} from "@/lib/order-store";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { isUnsetShipmentCustomer } from "@/lib/shipment";
import { formatNumber, selectItemValues } from "@/lib/utils";

function emptyForm(order: Order | null) {
  return {
    customer:
      order && !isUnsetShipmentCustomer(order.customer) ? order.customer : "",
    destination: order?.destination ?? "",
    stockItemId: "",
    quantity: order?.quantity ? String(order.quantity) : "",
  };
}

function productKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[İIıi]/g, "i")
    .toLocaleLowerCase("tr");
}

function matchesOrderProduct(item: WarehouseStockItem, product: string) {
  const key = productKey(product);
  return productKey(item.name) === key || productKey(item.sku) === key;
}

export function ShipOutDialog({
  open,
  order,
  onOpenChange,
  onShipped,
}: {
  open: boolean;
  order: Order | null;
  onOpenChange: (open: boolean) => void;
  onShipped?: (order: Order) => void;
}) {
  const { canRead } = useAuth();
  const standalone = !order;
  const [form, setForm] = useState(() => emptyForm(order));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);
  const [saving, setSaving] = useState(false);

  const customerOptions = useMemo(() => {
    const names = selectItemValues([
      ...customers.map((c) => c.name),
      ...customerNames,
      form.customer,
    ]).filter((name) => !isUnsetShipmentCustomer(name));
    return names;
  }, [customers, customerNames, form.customer]);

  const stockOptions = useMemo(() => {
    const product = order?.product ?? "";
    return [...stockItems]
      .filter(
        (item) => item.quantity > 0 && productKey(item.category) === "mamul"
      )
      .sort((a, b) => {
        if (!product) return a.name.localeCompare(b.name, "tr");
        const ma = matchesOrderProduct(a, product) ? 0 : 1;
        const mb = matchesOrderProduct(b, product) ? 0 : 1;
        if (ma !== mb) return ma - mb;
        return a.name.localeCompare(b.name, "tr");
      });
  }, [stockItems, order?.product]);

  const selected = stockOptions.find((item) => item.id === form.stockItemId);
  const maxQty = selected
    ? order
      ? Math.min(selected.quantity, order.quantity)
      : selected.quantity
    : order?.quantity ?? 0;

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm(order));
    void (async () => {
      const [catalog, names, stock] = await Promise.all([
        ifAllowed(canRead("customers"), () => fetchCustomers(), [] as Customer[]),
        getOrderCustomers(),
        ifAllowed(
          canRead("stock"),
          () => getAllWarehouseStockItems(),
          [] as WarehouseStockItem[]
        ),
      ]);
      setCustomers(catalog.filter((c) => c.active !== false));
      setCustomerNames(names);
      setStockItems(stock);
      const product = order?.product ?? "";
      const match = product
        ? stock.find(
            (item) =>
              item.quantity > 0 &&
              productKey(item.category) === "mamul" &&
              matchesOrderProduct(item, product)
          )
        : undefined;
      const picked = match ?? undefined;
      const max = picked
        ? order
          ? Math.min(picked.quantity, order.quantity)
          : picked.quantity
        : order?.quantity;
      setForm((f) => ({
        ...f,
        stockItemId: picked?.id ?? f.stockItemId,
        quantity:
          max != null
            ? String(max)
            : f.quantity,
      }));
    })();
  }, [open, order, canRead]);

  function applyCustomer(name: string) {
    const match = customers.find((c) => c.name === name);
    setForm((f) => ({
      ...f,
      customer: name,
      destination: match?.address?.trim() || f.destination,
    }));
  }

  function applyStock(stockItemId: string) {
    const item = stockOptions.find((s) => s.id === stockItemId);
    const max = item
      ? order
        ? Math.min(item.quantity, order.quantity)
        : item.quantity
      : undefined;
    setForm((f) => ({
      ...f,
      stockItemId,
      quantity: max != null ? String(max) : f.quantity,
    }));
  }

  async function submit() {
    const customer = form.customer.trim();
    const destination = form.destination.trim();
    if (isUnsetShipmentCustomer(customer) || !destination) {
      toast.error("Müşteri ve teslimat yeri gerekli");
      return;
    }
    if (!form.stockItemId) {
      toast.error("Sevk edilecek mamulü seçin");
      return;
    }
    const quantity = parseFloat(form.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Sevk miktarını girin");
      return;
    }
    if (selected && quantity > selected.quantity) {
      toast.error(
        `Stokta en fazla ${formatNumber(selected.quantity)} ${selected.unit} var`
      );
      return;
    }
    if (order && quantity > order.quantity) {
      toast.error(
        `Siparişte en fazla ${formatNumber(order.quantity)} ${order.unit} var`
      );
      return;
    }

    setSaving(true);
    try {
      const updated = order
        ? await updateOrderShipment(order.id, {
            status: "shipped",
            customer,
            destination,
            stockItemId: form.stockItemId,
            quantity,
          })
        : await createShipment({
            customer,
            destination,
            stockItemId: form.stockItemId,
            quantity,
          });
      toast.success(
        `${updated.orderNo} sevk edildi — ${formatNumber(quantity)} ${updated.unit} mamul stoktan düşüldü`
      );
      onOpenChange(false);
      onShipped?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sevk edilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onOpenChange(false);
      }}
      title={standalone ? "Yeni sevk başlat" : "Sevke çıkar"}
      description={
        order
          ? `${order.orderNo}${order.batchNo ? ` · ${order.batchNo}` : ""}`
          : "Mamul stoğundan kısmi veya tam miktar sevk edin."
      }
      icon={Truck}
      className="max-w-md"
    >
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Müşteri ve teslimat yerini girin. Seçtiğiniz miktar mamul stoğundan düşülür;
          kalan stok depoda kalır.
        </p>
        {customerOptions.length > 0 ? (
          <FormField label="Kayıtlı müşteri">
            <Select
              value={
                customerOptions.includes(form.customer)
                  ? form.customer
                  : undefined
              }
              onValueChange={applyCustomer}
              disabled={saving}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Listeden seçin" />
              </SelectTrigger>
              <SelectContent>
                {customerOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <FormField label="Müşteri / alıcı" htmlFor="ship-customer" required>
          <Input
            id="ship-customer"
            className="rounded-xl"
            value={form.customer}
            disabled={saving}
            placeholder="Örn. eczane, depo, müşteri adı"
            onChange={(e) =>
              setForm((f) => ({ ...f, customer: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Teslimat yeri" htmlFor="ship-destination" required>
          <Textarea
            id="ship-destination"
            value={form.destination}
            disabled={saving}
            placeholder="Adres, şehir veya teslim noktası"
            onChange={(e) =>
              setForm((f) => ({ ...f, destination: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Mamul ürün" required>
          {stockOptions.length > 0 ? (
            <Select
              value={form.stockItemId || undefined}
              onValueChange={applyStock}
              disabled={saving}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Hazır mamul seçin" />
              </SelectTrigger>
              <SelectContent>
                {stockOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {getWarehouseName(item.warehouseId)} ·{" "}
                    {formatNumber(item.quantity)} {item.unit} · {item.lotNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-amber-700">
              Sevk edilecek mamul stoğu yok.
            </p>
          )}
        </FormField>
        <FormField
          label="Sevk miktarı"
          htmlFor="ship-qty"
          required
          hint={
            selected
              ? `Stokta ${formatNumber(selected.quantity)} ${selected.unit}${
                  order
                    ? ` · sipariş ${formatNumber(order.quantity)} ${order.unit}`
                    : ""
                }`
              : "Stoktan düşülecek adet"
          }
        >
          <Input
            id="ship-qty"
            type="number"
            min={0.0001}
            max={maxQty || undefined}
            step="any"
            className="rounded-xl"
            value={form.quantity}
            disabled={saving || !selected}
            onChange={(e) =>
              setForm((f) => ({ ...f, quantity: e.target.value }))
            }
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          İptal
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={saving || stockOptions.length === 0}
          onClick={() => void submit()}
        >
          Sevke çıkar
        </Button>
      </div>
    </FormDialog>
  );
}
