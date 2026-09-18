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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { Customer, DeliveryNote, DeliveryNoteLine, FinishedProduct, Invoice, InvoiceLine, Supplier } from "@/data/catalog";
import type { Order } from "@/data/mock";
import type { RawMaterial } from "@/data/raw-materials";
import type { RawMaterialOrder } from "@/data/raw-material-orders";
import {
  WAREHOUSE_IDS,
  finishedWarehouseFallbackNames,
  getWarehouseName,
  isFinishedWarehouseType,
  type Warehouse,
} from "@/data/warehouses";
import {
  createCatalog,
  fetchCustomers,
  fetchDeliveryNotes,
  fetchInvoiceLines,
  fetchInvoices,
  fetchProducts,
  fetchSuppliers,
  updateCatalog,
} from "@/lib/catalog-store";
import { getWarehouses } from "@/lib/warehouse-store";
import { getAllOrders } from "@/lib/order-store";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getAllRawMaterialOrders } from "@/lib/raw-material-order-store";
import {
  isReadyToShip,
  isUnsetShipmentCustomer,
  readyShipmentLabel,
} from "@/lib/shipment";
import {
  isPurchaseInvoice,
  isSalesSideInvoice,
  LINE_UNITS,
  nextDocumentNo,
} from "@/lib/invoice-docs";
import { todayIso, nowTimeHm } from "@/lib/utils";
import { TURKEY_COUNTRIES, TURKEY_DISTRICTS, TURKEY_PROVINCES } from "@/data/turkey-locations";

const KINDS = ["Satış", "Alış"] as const;
const STATUSES = ["Taslak", "Düzenlendi", "Sevk edildi", "Teslim"] as const;
const SHIP_METHODS = [
  "Kendi aracımla gönderiyorum",
  "Kargo",
  "Nakliyeci ile",
  "Alıcı kendi alacak",
] as const;
const RECEIVE_METHODS = [
  "Tedarikçi aracıyla geldi",
  "Kargo",
  "Nakliyeci ile",
  "Kendi aracımızla aldık",
] as const;
const PLATE_ORIGINS = ["Türkiye plaka", "Yabancı plaka"] as const;

type LineForm = {
  description: string;
  quantityLabel: string;
  unit: string;
};

function emptyLine(): LineForm {
  return { description: "", quantityLabel: "1", unit: "Adet" };
}

function uniqueWarehouseNames(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("tr");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function defaultWarehouseName(list: Warehouse[], current?: string, kind = "Satış") {
  if (current?.trim()) return current.trim();
  if (kind === "Alış") {
    const production = getWarehouseName(WAREHOUSE_IDS.production);
    return (
      list.find((w) => w.id === WAREHOUSE_IDS.production)?.name ||
      list.find((w) => w.type === "production")?.name ||
      production
    );
  }
  const finished = uniqueWarehouseNames([
    ...list.filter((w) => isFinishedWarehouseType(w.type)).map((w) => w.name),
    ...finishedWarehouseFallbackNames(),
  ]);
  const names = uniqueWarehouseNames([
    ...finished,
    ...list.map((w) => w.name),
    getWarehouseName(WAREHOUSE_IDS.production),
    getWarehouseName(WAREHOUSE_IDS.packaging),
    getWarehouseName(WAREHOUSE_IDS.laboratory),
  ]);
  const mamulFactory = getWarehouseName(WAREHOUSE_IDS.finishedFactory);
  return (
    names.find((n) => n.toLocaleLowerCase("tr") === mamulFactory.toLocaleLowerCase("tr")) ||
    finished[0] ||
    names[0] ||
    mamulFactory
  );
}

function emptyForm(
  noteNo: string,
  row?: DeliveryNote,
  lines?: DeliveryNoteLine[],
  warehouse = getWarehouseName(WAREHOUSE_IDS.finishedFactory)
) {
  return {
    noteNo: row?.noteNo ?? noteNo,
    party: row?.party ?? "",
    kind: row?.kind ?? "Satış",
    issueDate: row?.issueDate || todayIso(),
    shipDate: row?.shipDate || todayIso(),
    warehouse: row?.warehouse?.trim() || warehouse,
    relatedOrderNo: row?.relatedOrderNo ?? "",
    relatedInvoiceNo: row?.relatedInvoiceNo ?? "",
    status: row?.status ?? "Düzenlendi",
    partyTaxNo: row?.partyTaxNo ?? "",
    partyAddress: row?.partyAddress ?? "",
    partyCity: row?.partyCity ?? "",
    partyDistrict: row?.partyDistrict ?? "",
    partyCountry: row?.partyCountry || "Türkiye",
    partyPostalCode: row?.partyPostalCode ?? "",
    driverName: row?.driverName ?? "",
    driverNationalId: row?.driverNationalId ?? "",
    plateNo: row?.plateNo ?? "",
    trailerPlate: row?.trailerPlate ?? "",
    plateOrigin: row?.plateOrigin || "Türkiye plaka",
    shipMethod: row?.shipMethod || (row?.kind === "Alış" ? RECEIVE_METHODS[0] : SHIP_METHODS[0]),
    dispatchAddress: row?.dispatchAddress || warehouse,
    issueTime: row?.issueTime || nowTimeHm(),
    shipTime: row?.shipTime || nowTimeHm(),
    relatedOrderDate: row?.relatedOrderDate ?? "",
    packages: row?.packages ?? "",
    notes: row?.notes ?? "",
    lines:
      lines && lines.length > 0
        ? lines.map((l) => ({
            description: l.description,
            quantityLabel: l.quantityLabel,
            unit: l.unit,
          }))
        : [emptyLine()],
  };
}

export function DeliveryNoteFormSheet({
  open,
  onOpenChange,
  editing,
  editingLines,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: DeliveryNote | null;
  editingLines?: DeliveryNoteLine[];
  prefill?: {
    party?: string;
    partyAddress?: string;
    relatedOrderNo?: string;
    relatedOrderDate?: string;
    warehouse?: string;
    lines?: LineForm[];
  };
  onSaved?: (note?: DeliveryNote) => void;
}) {
  const [form, setForm] = useState(() => emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [inboundOrders, setInboundOrders] = useState<RawMaterialOrder[]>([]);
  const inbound = form.kind === "Alış";

  const productOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string; keywords: string; unit: string }[] = [];
    const push = (name: string, keywords: string, unit: string, tag?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLocaleLowerCase("tr");
      if (seen.has(key)) return;
      seen.add(key);
      options.push({
        value: trimmed,
        label: tag ? `${trimmed} · ${tag}` : trimmed,
        keywords,
        unit: unit.trim() || "Adet",
      });
    };
    if (inbound) {
      for (const material of rawMaterials) {
        push(material.name, `${material.sku} ${material.category}`, material.unit, "Hammadde");
      }
    }
    for (const product of products) {
      push(
        product.name,
        `${product.sku} ${product.lotNo} ${product.warehouse ?? ""}`,
        product.unit,
        inbound ? "Mamul" : undefined
      );
    }
    return options;
  }, [products, rawMaterials, inbound]);

  const partyOptions = useMemo(() => {
    const seen = new Set<string>();
    const add = (
      rows: {
        name: string;
        taxNo: string;
        address: string;
        city?: string;
        district?: string;
        country?: string;
      }[],
      kind: "müşteri" | "tedarikçi"
    ) => {
      const out: {
        value: string;
        label: string;
        taxNo: string;
        address: string;
        city: string;
        district: string;
        country: string;
      }[] = [];
      for (const row of rows) {
        const name = row.name.trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase("tr");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          value: name,
          label: `${name} (${kind})`,
          taxNo: row.taxNo,
          address: row.address,
          city: row.city ?? "",
          district: row.district ?? "",
          country: row.country ?? "",
        });
      }
      return out;
    };
    if (form.kind === "Alış") return add(suppliers, "tedarikçi");
    return add(customers, "müşteri").concat(add(suppliers, "tedarikçi"));
  }, [customers, suppliers, form.kind]);

  const warehouseOptions = useMemo(
    () =>
      uniqueWarehouseNames([
        form.warehouse,
        ...warehouses.filter((w) => isFinishedWarehouseType(w.type)).map((w) => w.name),
        ...finishedWarehouseFallbackNames(),
        ...warehouses.map((w) => w.name),
        ...products.map((p) => p.warehouse ?? ""),
        getWarehouseName(WAREHOUSE_IDS.production),
        getWarehouseName(WAREHOUSE_IDS.packaging),
        getWarehouseName(WAREHOUSE_IDS.laboratory),
      ]),
    [form.warehouse, warehouses, products]
  );
  const finishedWarehouseOptions = useMemo(() => {
    const keys = new Set(
      uniqueWarehouseNames([
        ...warehouses.filter((w) => isFinishedWarehouseType(w.type)).map((w) => w.name),
        ...finishedWarehouseFallbackNames(),
      ]).map((name) => name.toLocaleLowerCase("tr"))
    );
    return warehouseOptions.filter((name) => keys.has(name.toLocaleLowerCase("tr")));
  }, [warehouseOptions, warehouses]);
  const otherWarehouseOptions = useMemo(() => {
    const keys = new Set(finishedWarehouseOptions.map((name) => name.toLocaleLowerCase("tr")));
    return warehouseOptions.filter((name) => !keys.has(name.toLocaleLowerCase("tr")));
  }, [warehouseOptions, finishedWarehouseOptions]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
      fetchDeliveryNotes().catch(() => [] as DeliveryNote[]),
      fetchProducts().catch(() => [] as FinishedProduct[]),
      getWarehouses().catch(() => [] as Warehouse[]),
      getAllOrders().catch(() => [] as Order[]),
      fetchInvoices().catch(() => [] as Invoice[]),
      fetchInvoiceLines().catch(() => [] as InvoiceLine[]),
      getAllRawMaterials().catch(() => [] as RawMaterial[]),
      getAllRawMaterialOrders().catch(() => [] as RawMaterialOrder[]),
    ])
      .then(([c, s, notes, productRows, warehouseRows, orders, invoiceRows, invoiceLineRows, materialRows, rmoRows]) => {
      setCustomers(c);
      setSuppliers(s);
      setProducts(productRows);
      setWarehouses(warehouseRows);
      setInvoices(invoiceRows);
      setInvoiceLines(invoiceLineRows);
      setRawMaterials(materialRows);
      setInboundOrders(
        rmoRows.filter(
          (row) =>
            row.status === "to_order" || row.status === "ordered" || row.status === "received"
        )
      );
      setReadyOrders(orders.filter((order) => isReadyToShip(order.status)));
      const nextNo = nextDocumentNo(
        notes.map((n) => n.noteNo),
        "IRS"
      );
      const base = emptyForm(
        nextNo,
        editing ?? undefined,
        editingLines,
        defaultWarehouseName(
          warehouseRows,
          editing?.warehouse || prefill?.warehouse,
          editing?.kind || "Satış"
        )
      );
      if (!editing && prefill) {
        setForm({
          ...base,
          party: prefill.party?.trim() || base.party,
          partyAddress: prefill.partyAddress?.trim() || base.partyAddress,
          relatedOrderNo: prefill.relatedOrderNo?.trim() || base.relatedOrderNo,
          relatedOrderDate: prefill.relatedOrderDate?.trim() || base.relatedOrderDate,
          warehouse: prefill.warehouse?.trim() || base.warehouse,
          dispatchAddress:
            prefill.warehouse?.trim() || base.dispatchAddress || base.warehouse,
          lines:
            prefill.lines && prefill.lines.length > 0 ? prefill.lines : base.lines,
        });
        return;
      }
      setForm(base);
    })
      .catch(() => {
        setReadyOrders([]);
      });
  }, [open, editing, editingLines]);

  const readyOrderOptions = useMemo(() => {
    const current = form.relatedOrderNo.trim();
    const rows = [...readyOrders];
    if (current && !rows.some((order) => order.orderNo === current)) {
      rows.unshift({
        id: current,
        orderNo: current,
        customer: form.party,
        product: form.lines[0]?.description || "",
        quantity: 0,
        unit: form.lines[0]?.unit || "Adet",
        status: "confirmed",
        orderDate: form.issueDate,
        deliveryDate: form.shipDate,
        priority: "normal",
        warehouse: form.warehouse,
        value: 0,
      });
    }
    return rows.map((order) => ({
      value: order.orderNo,
      label: readyShipmentLabel(order),
      keywords: `${order.customer} ${order.product} ${order.batchNo ?? ""} ${order.orderNo}`,
    }));
  }, [readyOrders, form.relatedOrderNo, form.party, form.lines, form.issueDate, form.shipDate, form.warehouse]);

  const invoiceOptions = useMemo(() => {
    const rows = invoices.filter((invoice) =>
      inbound ? isPurchaseInvoice(invoice) : isSalesSideInvoice(invoice)
    );
    const current = form.relatedInvoiceNo.trim();
    if (current && !rows.some((invoice) => invoice.invoiceNo === current)) {
      rows.unshift({
        id: current,
        invoiceNo: current,
        party: form.party,
        kind: inbound ? "Alış" : "Satış",
        issueDate: form.issueDate,
        dueDate: form.issueDate,
        amount: 0,
        status: "",
        documentType: inbound ? "purchase" : "sales",
        bucket: inbound ? "expense" : "income",
        confirmed: false,
        eDocument: "",
        scenario: "",
        series: "",
        currency: "TRY",
        fxRate: 1,
        partyTaxNo: "",
        partyTaxOffice: "",
        partyAddress: "",
        partyCity: "",
        partyDistrict: "",
        partyPhone: "",
        partyEmail: "",
        sellerName: "",
        sellerTaxNo: "",
        sellerTaxOffice: "",
        sellerAddress: "",
        paymentMethod: "",
        relatedDispatchNo: "",
        relatedOrderNo: "",
        notes: "",
        validUntil: "",
        deliveryTerm: "",
        preparedBy: "",
        subtotal: 0,
        totalDiscount: 0,
        totalVat: 0,
        withholding: 0,
        paidAmount: 0,
      });
    }
    return rows.map((invoice) => ({
      value: invoice.invoiceNo,
      label: `${invoice.invoiceNo} · ${invoice.party || "Fatura"}`,
      keywords: `${invoice.party} ${invoice.kind} ${invoice.partyTaxNo}`,
    }));
  }, [invoices, inbound, form.relatedInvoiceNo, form.party, form.issueDate]);

  const inboundOrderOptions = useMemo(
    () =>
      inboundOrders.map((order) => ({
        value: order.orderNo,
        label: `${order.orderNo} · ${order.supplier} · ${order.materialName}`,
        keywords: `${order.sku} ${order.supplier} ${order.materialName}`,
      })),
    [inboundOrders]
  );

  const methodOptions = useMemo(() => {
    const base = inbound ? RECEIVE_METHODS : SHIP_METHODS;
    return uniqueWarehouseNames([form.shipMethod, ...base]);
  }, [inbound, form.shipMethod]);

  const districtOptions = TURKEY_DISTRICTS[form.partyCity] ?? [];

  function applyParty(name: string) {
    const hit = partyOptions.find((p) => p.value === name);
    const supplier = suppliers.find((row) => row.name === name);
    setForm((f) => ({
      ...f,
      party: name,
      partyTaxNo: hit?.taxNo || f.partyTaxNo,
      partyAddress: hit?.address || f.partyAddress,
      partyCity: hit?.city || supplier?.city || f.partyCity,
      partyDistrict: hit?.district || supplier?.district || f.partyDistrict,
      partyCountry: hit?.country || supplier?.country || f.partyCountry || "Türkiye",
    }));
  }

  function applyReadyOrder(orderNo: string) {
    const order = readyOrders.find((row) => row.orderNo === orderNo);
    if (!order) {
      setForm((f) => ({ ...f, relatedOrderNo: orderNo }));
      return;
    }
    const assignedCustomer = isUnsetShipmentCustomer(order.customer)
      ? ""
      : order.customer;
    const customer = customers.find((row) => row.name === assignedCustomer);
    const finishedKeys = new Set(
      uniqueWarehouseNames([
        ...warehouses.filter((w) => isFinishedWarehouseType(w.type)).map((w) => w.name),
        ...finishedWarehouseFallbackNames(),
      ]).map((name) => name.toLocaleLowerCase("tr"))
    );
    const orderWarehouse = order.warehouse?.trim() || "";
    const warehouse =
      orderWarehouse && finishedKeys.has(orderWarehouse.toLocaleLowerCase("tr"))
        ? orderWarehouse
        : "";
    setForm((f) => ({
      ...f,
      kind: "Satış",
      party: assignedCustomer || f.party,
      relatedOrderNo: order.orderNo,
      relatedOrderDate: order.orderDate || f.relatedOrderDate,
      warehouse: warehouse || f.warehouse,
      dispatchAddress:
        f.dispatchAddress.trim() &&
        f.dispatchAddress.trim().toLocaleLowerCase("tr") !==
          f.warehouse.trim().toLocaleLowerCase("tr")
          ? f.dispatchAddress
          : warehouse || f.warehouse,
      partyAddress: order.destination?.trim() || customer?.address || f.partyAddress,
      partyTaxNo: customer?.taxNo || f.partyTaxNo,
      lines: [
        {
          description: order.product,
          quantityLabel: String(order.quantity),
          unit: order.unit?.trim() || "Adet",
        },
      ],
    }));
  }

  function applyInboundOrder(orderNo: string) {
    const order = inboundOrders.find((row) => row.orderNo === orderNo);
    if (!order) {
      setForm((f) => ({ ...f, relatedOrderNo: orderNo }));
      return;
    }
    const hit = partyOptions.find((p) => p.value === order.supplier);
    const supplier = suppliers.find((row) => row.name === order.supplier);
    setForm((f) => ({
      ...f,
      kind: "Alış",
      relatedOrderNo: order.orderNo,
      relatedOrderDate: order.orderDate || f.relatedOrderDate,
      relatedInvoiceNo: order.invoiceNo || f.relatedInvoiceNo,
      party: order.supplier || f.party,
      partyTaxNo: hit?.taxNo || f.partyTaxNo,
      partyAddress: hit?.address || f.partyAddress,
      partyCity: hit?.city || supplier?.city || f.partyCity,
      partyDistrict: hit?.district || supplier?.district || f.partyDistrict,
      partyCountry: hit?.country || supplier?.country || f.partyCountry || "Türkiye",
      lines: [
        {
          description: order.materialName,
          quantityLabel: String(order.quantity),
          unit: order.unit?.trim() || "kg",
        },
      ],
    }));
  }

  function applyInvoice(invoiceNo: string) {
    const invoice = invoices.find((row) => row.invoiceNo === invoiceNo);
    if (!invoice) {
      setForm((f) => ({ ...f, relatedInvoiceNo: invoiceNo }));
      return;
    }
    const lines = invoiceLines
      .filter((line) => line.invoiceNo === invoice.invoiceNo)
      .map((line) => ({
        description: line.description,
        quantityLabel: line.quantityLabel || String(line.quantity || 1),
        unit: line.unit?.trim() || "Adet",
      }));
    const hit = partyOptions.find((p) => p.value === invoice.party);
    const supplier = suppliers.find((row) => row.name === invoice.party);
    setForm((f) => ({
      ...f,
      relatedInvoiceNo: invoice.invoiceNo,
      relatedOrderNo: invoice.relatedOrderNo || f.relatedOrderNo,
      party: invoice.party || f.party,
      partyTaxNo: invoice.partyTaxNo || hit?.taxNo || f.partyTaxNo,
      partyAddress: invoice.partyAddress || hit?.address || f.partyAddress,
      partyCity: invoice.partyCity || hit?.city || supplier?.city || f.partyCity,
      partyDistrict:
        invoice.partyDistrict || hit?.district || supplier?.district || f.partyDistrict,
      lines: lines.length > 0 ? lines : f.lines,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = form.lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantityLabel: l.quantityLabel.trim() || "1",
        unit: l.unit.trim() || "Adet",
      }));
    if (!form.noteNo.trim() || !form.party.trim() || !form.warehouse.trim()) {
      toast.error(
        inbound ? "İrsaliye no, gönderici ve depo zorunludur" : "İrsaliye no, alıcı ve depo zorunludur"
      );
      return;
    }
    if (lines.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    setSaving(true);
    try {
      const body = {
        noteNo: form.noteNo.trim(),
        party: form.party.trim(),
        kind: form.kind,
        issueDate: form.issueDate,
        shipDate: form.shipDate,
        warehouse: form.warehouse.trim(),
        relatedOrderNo: form.relatedOrderNo.trim(),
        relatedInvoiceNo: form.relatedInvoiceNo.trim(),
        status: form.status,
        partyTaxNo: form.partyTaxNo.trim(),
        partyAddress: form.partyAddress.trim(),
        partyCity: form.partyCity.trim(),
        partyDistrict: form.partyDistrict.trim(),
        partyCountry: form.partyCountry.trim() || "Türkiye",
        partyPostalCode: form.partyPostalCode.trim(),
        driverName: form.driverName.trim(),
        driverNationalId: form.driverNationalId.trim(),
        plateNo: form.plateNo.trim(),
        trailerPlate: form.trailerPlate.trim(),
        plateOrigin: form.plateOrigin.trim(),
        shipMethod: form.shipMethod.trim(),
        dispatchAddress: form.dispatchAddress.trim() || form.warehouse.trim(),
        issueTime: form.issueTime.trim(),
        shipTime: form.shipTime.trim(),
        relatedOrderDate: form.relatedOrderDate.trim(),
        packages: form.packages.trim(),
        notes: form.notes.trim(),
        lines,
      };
      if (editing) {
        const updated = await updateCatalog<DeliveryNote>("delivery-notes", editing.id, body);
        toast.success(
          inbound
            ? "Mal kabul irsaliyesi güncellendi. Hammadde kalemleri kalite kontrole alındı."
            : "İrsaliye güncellendi"
        );
        onOpenChange(false);
        onSaved?.(updated);
      } else {
        const created = await createCatalog<DeliveryNote>("delivery-notes", body);
        toast.success(
          inbound
            ? "Mal kabul irsaliyesi kaydedildi. Hammadde kalemleri depo kalite kontrolüne düştü."
            : "İrsaliye oluşturuldu"
        );
        onOpenChange(false);
        onSaved?.(created);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Truck}
      title={
        editing
          ? inbound
            ? "Mal kabul irsaliyesini düzenle"
            : "Sevk irsaliyesini düzenle"
          : inbound
            ? "Yeni mal kabul irsaliyesi"
            : "Yeni sevk irsaliyesi"
      }
      description={
        inbound
          ? "Gönderici tedarikçi firmadır. Getirici bilgilerini ve gelen malları girin. Hammaddeler kalite kontrole düşer."
          : "Gönderici bilgisi PDF ayarlarından gelir. Alıcı, gönderim ve irsaliye bilgilerini girin."
      }
      className="max-w-4xl max-h-[min(92dvh,58rem)]"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="İrsaliye">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="İrsaliye no" htmlFor="dn-no" required>
                <Input
                  id="dn-no"
                  required
                  className="bg-white font-mono"
                  value={form.noteNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, noteNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Tür" required>
                <Select
                  value={form.kind}
                  onValueChange={(kind) =>
                    setForm((f) => {
                      const warehouse = defaultWarehouseName(warehouses, undefined, kind);
                      return {
                        ...f,
                        kind,
                        party: "",
                        relatedOrderNo: "",
                        relatedInvoiceNo: "",
                        shipMethod:
                          kind === "Alış" ? RECEIVE_METHODS[0] : SHIP_METHODS[0],
                        warehouse,
                        dispatchAddress: warehouse,
                      };
                    })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k === "Satış" ? "Sevk (satış)" : "Mal kabul (alış)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Durum" required>
                <Select
                  value={form.status}
                  onValueChange={(status) => setForm((f) => ({ ...f, status }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Depo" required>
                <Select
                  value={
                    warehouseOptions.includes(form.warehouse)
                      ? form.warehouse
                      : warehouseOptions[0]
                  }
                  onValueChange={(warehouse) =>
                    setForm((f) => ({
                      ...f,
                      warehouse,
                      dispatchAddress:
                        !f.dispatchAddress.trim() ||
                        f.dispatchAddress.trim().toLocaleLowerCase("tr") ===
                          f.warehouse.trim().toLocaleLowerCase("tr")
                          ? warehouse
                          : f.dispatchAddress,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Depo seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {(inbound ? otherWarehouseOptions : finishedWarehouseOptions).length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>
                          {inbound ? "Hammadde depoları" : "Mamul stok depoları"}
                        </SelectLabel>
                        {(inbound ? otherWarehouseOptions : finishedWarehouseOptions).map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                    {(inbound ? finishedWarehouseOptions : otherWarehouseOptions).length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>
                          {inbound ? "Mamul stok depoları" : "Hammadde depoları"}
                        </SelectLabel>
                        {(inbound ? finishedWarehouseOptions : otherWarehouseOptions).map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title={inbound ? "Gönderici" : "Alıcı"}
            description={
              inbound
                ? "Malı getiren tedarikçi firma. Unvan seçilince vergi ve adres dolar."
                : undefined
            }
          >
            {form.kind === "Satış" ? (
              <FormField
                label="Sevke hazır iş"
                hint="Sevkiyat işini seçince ürün kalemleri dolar. Müşteri yoksa alıcıyı ayrıca seçin."
              >
                <SearchableSelect
                  value={form.relatedOrderNo || undefined}
                  onValueChange={applyReadyOrder}
                  placeholder="Sevke hazır sipariş seçin"
                  searchPlaceholder="Sipariş no veya müşteri ara…"
                  emptyText="Sevke hazır iş yok"
                  allowCustom
                  options={readyOrderOptions}
                />
              </FormField>
            ) : (
              <FormField
                label="Beklenen teslimat"
                hint="Açık hammadde talebini seçince tedarikçi ve mal kalemi dolar."
                optional
              >
                <SearchableSelect
                  value={form.relatedOrderNo || undefined}
                  onValueChange={applyInboundOrder}
                  placeholder="Hammadde talebi seçin"
                  searchPlaceholder="Talep no, tedarikçi veya malzeme ara…"
                  emptyText="Açık hammadde talebi yok"
                  allowCustom
                  options={inboundOrderOptions}
                />
              </FormField>
            )}
            <FormField label="Unvan" required>
              <SearchableSelect
                value={form.party || undefined}
                onValueChange={applyParty}
                placeholder={inbound ? "Tedarikçi seçin veya arayın" : "Alıcı seçin veya arayın"}
                searchPlaceholder="Cari ara…"
                emptyText="Kayıt yok"
                options={partyOptions.map((p) => ({
                  value: p.value,
                  label: p.label,
                  keywords: `${p.taxNo} ${p.address} ${p.city}`,
                }))}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <FormField label="Ülke">
                <Select
                  value={form.partyCountry || "Türkiye"}
                  onValueChange={(partyCountry) => setForm((f) => ({ ...f, partyCountry }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TURKEY_COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="İl">
                <SearchableSelect
                  value={form.partyCity || undefined}
                  onValueChange={(partyCity) =>
                    setForm((f) => ({
                      ...f,
                      partyCity,
                      partyDistrict: (TURKEY_DISTRICTS[partyCity] ?? []).includes(f.partyDistrict)
                        ? f.partyDistrict
                        : "",
                    }))
                  }
                  placeholder="İl seçin"
                  searchPlaceholder="İl ara…"
                  options={TURKEY_PROVINCES.map((city) => ({ value: city, label: city }))}
                  allowCustom
                />
              </FormField>
              <FormField label="İlçe">
                <SearchableSelect
                  value={form.partyDistrict || undefined}
                  onValueChange={(partyDistrict) => setForm((f) => ({ ...f, partyDistrict }))}
                  placeholder="İlçe seçin"
                  searchPlaceholder="İlçe ara…"
                  emptyText="Önce il seçin"
                  disabled={!form.partyCity}
                  options={districtOptions.map((d) => ({ value: d, label: d }))}
                  allowCustom
                />
              </FormField>
              <FormField label="Posta kodu" htmlFor="dn-zip" optional>
                <Input
                  id="dn-zip"
                  className="bg-white"
                  value={form.partyPostalCode}
                  onChange={(e) => setForm((f) => ({ ...f, partyPostalCode: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label="Adres" htmlFor="dn-addr" optional>
              <Input
                id="dn-addr"
                className="bg-white"
                value={form.partyAddress}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partyAddress: e.target.value }))
                }
              />
            </FormField>
            <FormField label="VKN / TCKN" htmlFor="dn-tax" optional>
              <Input
                id="dn-tax"
                className="bg-white"
                value={form.partyTaxNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partyTaxNo: e.target.value }))
                }
              />
            </FormField>
          </FormSection>

          <FormSection
            title={inbound ? "Getirici" : "Gönderim"}
            description={
              inbound
                ? "Malı fabrikaya getiren şoför / nakliyeci bilgileri."
                : undefined
            }
          >
            <FormField label={inbound ? "Getirim şekli" : "Gönderim şekli"}>
              <Select
                value={form.shipMethod}
                onValueChange={(shipMethod) => setForm((f) => ({ ...f, shipMethod }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methodOptions.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FormField
                label={inbound ? "Getirici adı soyadı" : "Şoför adı soyadı"}
                htmlFor="dn-drv"
                optional
              >
                <Input
                  id="dn-drv"
                  className="bg-white"
                  value={form.driverName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driverName: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="TC kimlik" htmlFor="dn-tckn" optional>
                <Input
                  id="dn-tckn"
                  className="bg-white"
                  inputMode="numeric"
                  maxLength={11}
                  value={form.driverNationalId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      driverNationalId: e.target.value.replace(/\D/g, "").slice(0, 11),
                    }))
                  }
                />
              </FormField>
              <FormField label="Plaka" htmlFor="dn-plate" optional>
                <Input
                  id="dn-plate"
                  className="bg-white uppercase"
                  value={form.plateNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plateNo: e.target.value.toUpperCase() }))
                  }
                />
              </FormField>
              <FormField label="Dorse plaka" htmlFor="dn-trailer" optional>
                <Input
                  id="dn-trailer"
                  className="bg-white uppercase"
                  value={form.trailerPlate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, trailerPlate: e.target.value.toUpperCase() }))
                  }
                />
              </FormField>
              <FormField label="Menşei">
                <Select
                  value={form.plateOrigin}
                  onValueChange={(plateOrigin) => setForm((f) => ({ ...f, plateOrigin }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATE_ORIGINS.map((origin) => (
                      <SelectItem key={origin} value={origin}>
                        {origin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Diğer bilgiler">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label={inbound ? "Teslim adresi" : "İrsaliye adresi"}>
                <SearchableSelect
                  value={form.dispatchAddress || undefined}
                  onValueChange={(dispatchAddress) =>
                    setForm((f) => ({ ...f, dispatchAddress }))
                  }
                  placeholder={inbound ? "Mal kabul adresi / depo" : "Sevk çıkış adresi"}
                  searchPlaceholder="Adres veya şube ara…"
                  options={warehouseOptions.map((name) => ({ value: name, label: name }))}
                  allowCustom
                />
              </FormField>
              <FormField label="Ambalaj / koli" htmlFor="dn-pkg" optional>
                <Input
                  id="dn-pkg"
                  className="bg-white"
                  value={form.packages}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, packages: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="İrsaliye tarihi" htmlFor="dn-issue" required>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="dn-issue"
                    type="date"
                    required
                    className="bg-white"
                    value={form.issueDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, issueDate: e.target.value }))
                    }
                  />
                  <Input
                    type="time"
                    className="bg-white"
                    value={form.issueTime}
                    onChange={(e) => setForm((f) => ({ ...f, issueTime: e.target.value }))}
                  />
                </div>
              </FormField>
              <FormField label={inbound ? "Teslim tarihi" : "Sevk tarihi"} htmlFor="dn-ship" required>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="dn-ship"
                    type="date"
                    required
                    className="bg-white"
                    value={form.shipDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, shipDate: e.target.value }))
                    }
                  />
                  <Input
                    type="time"
                    className="bg-white"
                    value={form.shipTime}
                    onChange={(e) => setForm((f) => ({ ...f, shipTime: e.target.value }))}
                  />
                </div>
              </FormField>
              <FormField
                label={inbound ? "Talep / sipariş no" : "Sipariş no"}
                htmlFor="dn-order"
                optional
              >
                <Input
                  id="dn-order"
                  className="bg-white font-mono"
                  value={form.relatedOrderNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedOrderNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Sipariş tarihi" htmlFor="dn-order-date" optional>
                <Input
                  id="dn-order-date"
                  type="date"
                  className="bg-white"
                  value={form.relatedOrderDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedOrderDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Fatura no" htmlFor="dn-inv" optional>
                <SearchableSelect
                  value={form.relatedInvoiceNo || undefined}
                  onValueChange={applyInvoice}
                  placeholder="Fatura seçin veya yazın"
                  searchPlaceholder="Fatura no veya cari ara…"
                  emptyText="Kayıtlı fatura yok, elle yazabilirsiniz"
                  allowCustom
                  options={invoiceOptions}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Mallar"
            description={
              inbound
                ? "Hammadde veya ürün seçin. Hammaddeler kayıttan sonra depo kalite kontrolüne düşer; KK onayınca stoğa işlenir."
                : form.relatedOrderNo
                  ? "Seçilen sevkiyat işindeki ürünler otomatik dolduruldu; gerekirse düzenleyin. İrsaliye stok düşmez."
                  : "Mamul ürünlerden seçin veya elle yazın. İrsaliye stok düşmez."
            }
          >
            <div className="space-y-2">
              {form.lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-7">
                    <SearchableSelect
                      value={line.description || undefined}
                      allowCustom
                      placeholder={
                        inbound ? "Hammadde veya ürün seçin / yazın" : "Mamul seçin veya yazın"
                      }
                      searchPlaceholder={inbound ? "Hammadde veya ürün ara…" : "Ürün ara veya yaz…"}
                      emptyText={
                        inbound
                          ? "Liste boş, hammaddenin adını yazabilirsiniz"
                          : "Mamul yok, elle yazabilirsiniz"
                      }
                      options={productOptions.map((p) => ({
                        value: p.value,
                        label: p.label,
                        keywords: p.keywords,
                      }))}
                      onValueChange={(name) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          const hit = productOptions.find((p) => p.value === name);
                          lines[i] = {
                            ...lines[i],
                            description: name,
                            unit: hit?.unit || lines[i].unit,
                          };
                          return { ...f, lines };
                        })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Miktar"
                    className="bg-white sm:col-span-2"
                    value={line.quantityLabel}
                    onChange={(e) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = {
                          ...lines[i],
                          quantityLabel: e.target.value,
                        };
                        return { ...f, lines };
                      })
                    }
                  />
                  <Select
                    value={line.unit.trim() || "Adet"}
                    onValueChange={(unit) =>
                      setForm((f) => {
                        const lines = [...f.lines];
                        lines[i] = { ...lines[i], unit };
                        return { ...f, lines };
                      })
                    }
                  >
                    <SelectTrigger className="bg-white sm:col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[line.unit, ...LINE_UNITS]
                        .map((u) => u.trim())
                        .filter((u, i, all) => u && all.indexOf(u) === i)
                        .map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-xl border-dashed sm:w-auto"
              onClick={() =>
                setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Kalem ekle
            </Button>
          </FormSection>

          <FormSection title="Açıklama">
            <Textarea
              className="bg-white"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
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
          <Button type="submit" disabled={saving} className="rounded-xl">
            {saving
              ? "Kaydediliyor…"
              : editing
                ? "Değişiklikleri kaydet"
                : "İrsaliyeyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
