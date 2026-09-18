"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";
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
import { SearchableSelect } from "@/components/shared/searchable-select";
import { DeliveryNoteFormSheet } from "@/components/catalog/delivery-note-form-sheet";
import type { Order } from "@/data/mock";
import type { Customer, DeliveryNote, DeliveryNoteLine } from "@/data/catalog";
import { getWarehouseName, type WarehouseStockItem } from "@/data/warehouses";
import {
  fetchCustomers,
  fetchDeliveryNoteLines,
  fetchDeliveryNotes,
} from "@/lib/catalog-store";
import {
  createShipment,
  getAllOrders,
  getOrderCustomers,
  updateOrderShipment,
} from "@/lib/order-store";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  isReadyToShip,
  isUnsetShipmentCustomer,
  parseQuantityLabel,
} from "@/lib/shipment";
import { formatNumber, selectItemValues } from "@/lib/utils";

function emptyForm(order: Order | null) {
  return {
    customer:
      order && !isUnsetShipmentCustomer(order.customer) ? order.customer : "",
    destination: order?.destination ?? "",
    stockItemId: "",
    quantity: order?.quantity ? String(order.quantity) : "",
    noteNo: "",
    relatedOrderNo: order?.orderNo ?? "",
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
  const { canRead, canWrite } = useAuth();
  const standalone = !order;
  const [form, setForm] = useState(() => emptyForm(order));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [noteLines, setNoteLines] = useState<DeliveryNoteLine[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const customerOptions = useMemo(() => {
    const names = selectItemValues([
      ...customers.map((c) => c.name),
      ...customerNames,
      form.customer,
    ]).filter((name) => !isUnsetShipmentCustomer(name));
    return names;
  }, [customers, customerNames, form.customer]);

  const salesNotes = useMemo(
    () =>
      notes
        .filter((note) => note.kind !== "Alış")
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.noteNo.localeCompare(a.noteNo)),
    [notes]
  );

  const noteOptions = useMemo(
    () =>
      salesNotes.map((note) => ({
        value: note.noteNo,
        label: `${note.noteNo} · ${note.party}`,
        keywords: `${note.party} ${note.relatedOrderNo} ${note.status}`,
      })),
    [salesNotes]
  );

  const productHint = useMemo(() => {
    if (order?.product) return order.product;
    if (!form.noteNo) return "";
    return noteLines.find((line) => line.noteNo === form.noteNo)?.description ?? "";
  }, [order?.product, form.noteNo, noteLines]);

  const stockOptions = useMemo(() => {
    const product = productHint;
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
  }, [stockItems, productHint]);

  const selected = stockOptions.find((item) => item.id === form.stockItemId);
  const linkedOrder =
    order ??
    readyOrders.find(
      (row) => row.orderNo === form.relatedOrderNo && isReadyToShip(row.status)
    ) ??
    null;
  const maxQty = selected
    ? linkedOrder
      ? Math.min(selected.quantity, linkedOrder.quantity)
      : selected.quantity
    : linkedOrder?.quantity ?? 0;

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setNoteOpen(false);
    setForm(emptyForm(order));
    void (async () => {
      const [catalog, names, stock, deliveryNotes, lines, orders] = await Promise.all([
        ifAllowed(canRead("customers"), () => fetchCustomers(), [] as Customer[]),
        getOrderCustomers(),
        ifAllowed(
          canRead("stock"),
          () => getAllWarehouseStockItems(),
          [] as WarehouseStockItem[]
        ),
        ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNotes(), [] as DeliveryNote[]),
        ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNoteLines(), [] as DeliveryNoteLine[]),
        ifAllowed(canRead("orders"), () => getAllOrders(), [] as Order[]),
      ]);
      setCustomers(catalog.filter((c) => c.active !== false));
      setCustomerNames(names);
      setStockItems(stock);
      setNotes(deliveryNotes);
      setNoteLines(lines);
      setReadyOrders(orders.filter((row) => isReadyToShip(row.status)));
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
        quantity: max != null ? String(max) : f.quantity,
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
      ? linkedOrder
        ? Math.min(item.quantity, linkedOrder.quantity)
        : item.quantity
      : undefined;
    setForm((f) => ({
      ...f,
      stockItemId,
      quantity: max != null ? String(max) : f.quantity,
    }));
  }

  function applyDeliveryNote(noteNo: string, sourceNotes = notes, sourceLines = noteLines, sourceStock = stockItems) {
    const note = sourceNotes.find((row) => row.noteNo === noteNo);
    if (!note) {
      setForm((f) => ({ ...f, noteNo }));
      return;
    }
    const lines = sourceLines.filter((line) => line.noteNo === noteNo);
    const productNames = lines.map((line) => line.description).filter(Boolean);
    const match = productNames
      .map((name) =>
        sourceStock.find(
          (item) =>
            item.quantity > 0 &&
            productKey(item.category) === "mamul" &&
            matchesOrderProduct(item, name)
        )
      )
      .find(Boolean);
    const qty =
      lines.map((line) => parseQuantityLabel(line.quantityLabel)).find((n) => n > 0) ??
      (match && linkedOrder
        ? Math.min(match.quantity, linkedOrder.quantity)
        : match?.quantity);
    setForm((f) => ({
      ...f,
      noteNo: note.noteNo,
      relatedOrderNo: note.relatedOrderNo || f.relatedOrderNo,
      customer: note.party || f.customer,
      destination: note.partyAddress || f.destination,
      stockItemId: match?.id ?? f.stockItemId,
      quantity: qty != null ? String(qty) : f.quantity,
    }));
  }

  async function handleNoteSaved(note?: DeliveryNote) {
    const [deliveryNotes, lines] = await Promise.all([
      fetchDeliveryNotes().catch(() => [] as DeliveryNote[]),
      fetchDeliveryNoteLines().catch(() => [] as DeliveryNoteLine[]),
    ]);
    setNotes(deliveryNotes);
    setNoteLines(lines);
    if (note?.noteNo) {
      applyDeliveryNote(note.noteNo, deliveryNotes, lines, stockItems);
    }
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
    if (linkedOrder && quantity > linkedOrder.quantity) {
      toast.error(
        `Siparişte en fazla ${formatNumber(linkedOrder.quantity)} ${linkedOrder.unit} var`
      );
      return;
    }

    setSaving(true);
    try {
      const shipmentNote = form.noteNo.trim();
      const updated = linkedOrder
        ? await updateOrderShipment(linkedOrder.id, {
            status: "shipped",
            customer,
            destination,
            stockItemId: form.stockItemId,
            quantity,
            shipmentNote: shipmentNote || undefined,
          })
        : await createShipment({
            customer,
            destination,
            stockItemId: form.stockItemId,
            quantity,
            shipmentNote: shipmentNote || undefined,
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

  const selectedNoteLines = noteLines.filter((line) => line.noteNo === form.noteNo);

  return (
    <>
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving && !noteOpen) onOpenChange(false);
      }}
      title={standalone ? "Yeni sevk başlat" : "Sevke çıkar"}
      description={
        order
          ? `${order.orderNo}${order.batchNo ? ` · ${order.batchNo}` : ""}`
          : "İrsaliye seçin veya yeni oluşturun, sonra mamul stoğundan sevk edin."
      }
      icon={Truck}
      className="max-w-lg"
    >
      <div className="space-y-4 px-5 py-4">
        {canRead("delivery_notes") ? (
          <FormField
            label="Sevk irsaliyesi"
            hint="Kayıtlı irsaliyeyi seçince cari ve ürünler dolar."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  value={form.noteNo || undefined}
                  onValueChange={(noteNo) => applyDeliveryNote(noteNo)}
                  placeholder="İrsaliye seçin veya arayın"
                  searchPlaceholder="İrsaliye no veya cari ara…"
                  emptyText="İrsaliye yok"
                  disabled={saving}
                  options={noteOptions}
                />
              </div>
              {canWrite("delivery_notes") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl shrink-0"
                  disabled={saving}
                  onClick={() => setNoteOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Yeni irsaliye
                </Button>
              ) : null}
            </div>
          </FormField>
        ) : null}
        {selectedNoteLines.length > 0 ? (
          <ul className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
            {selectedNoteLines.map((line) => (
              <li key={line.id} className="flex justify-between gap-3">
                <span className="truncate">{line.description}</span>
                <span className="shrink-0 text-muted-foreground">
                  {line.quantityLabel} {line.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <FormField label="Müşteri / alıcı" required>
          <SearchableSelect
            value={form.customer}
            onValueChange={applyCustomer}
            placeholder="Müşteri seçin veya arayın"
            searchPlaceholder="Müşteri ara…"
            emptyText="Müşteri yok"
            allowCustom
            disabled={saving}
            options={customerOptions.map((name) => ({ value: name, label: name }))}
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
                  linkedOrder
                    ? ` · sipariş ${formatNumber(linkedOrder.quantity)} ${linkedOrder.unit}`
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
    <DeliveryNoteFormSheet
      open={noteOpen}
      onOpenChange={setNoteOpen}
      prefill={{
        party: form.customer,
        partyAddress: form.destination,
        relatedOrderNo: form.relatedOrderNo || order?.orderNo,
        relatedOrderDate: order?.orderDate,
        warehouse: order?.warehouse || selected?.warehouseId
          ? getWarehouseName(selected?.warehouseId ?? "")
          : undefined,
        lines:
          order || selected
            ? [
                {
                  description: order?.product || selected?.name || "",
                  quantityLabel: form.quantity || String(order?.quantity ?? 1),
                  unit: order?.unit || selected?.unit || "Adet",
                },
              ]
            : undefined,
      }}
      onSaved={(note) => void handleNoteSaved(note)}
    />
    </>
  );
}
