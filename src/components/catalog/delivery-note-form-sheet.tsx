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
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { Customer, DeliveryNote, DeliveryNoteLine, FinishedProduct, Supplier } from "@/data/catalog";
import type { Order } from "@/data/mock";
import {
  WAREHOUSE_IDS,
  getWarehouseName,
  type Warehouse,
} from "@/data/warehouses";
import {
  createCatalog,
  fetchCustomers,
  fetchDeliveryNotes,
  fetchProducts,
  fetchSuppliers,
  updateCatalog,
} from "@/lib/catalog-store";
import { getWarehouses } from "@/lib/warehouse-store";
import { getAllOrders } from "@/lib/order-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { isReadyToShip, isUnsetShipmentCustomer } from "@/lib/shipment";
import { LINE_UNITS, nextDocumentNo } from "@/lib/invoice-docs";
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

function defaultWarehouseName(list: Warehouse[], current?: string) {
  const names = uniqueWarehouseNames([
    current ?? "",
    ...list.map((w) => w.name),
    getWarehouseName(WAREHOUSE_IDS.production),
    getWarehouseName(WAREHOUSE_IDS.packaging),
    getWarehouseName(WAREHOUSE_IDS.laboratory),
  ]);
  if (current?.trim()) return current.trim();
  return (
    names.find((n) => n.toLocaleLowerCase("tr") === "fabrika") ||
    names[0] ||
    getWarehouseName(WAREHOUSE_IDS.production)
  );
}

function emptyForm(
  noteNo: string,
  row?: DeliveryNote,
  lines?: DeliveryNoteLine[],
  warehouse = "Fabrika"
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
    shipMethod: row?.shipMethod || "Kendi aracımla gönderiyorum",
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
  const { canRead } = useAuth();
  const [form, setForm] = useState(() => emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);

  const productOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string; keywords: string; unit: string }[] = [];
    for (const product of products) {
      const name = product.name.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("tr");
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: name,
        label: name,
        keywords: `${product.sku} ${product.lotNo} ${product.warehouse ?? ""}`,
        unit: product.unit.trim() || "Adet",
      });
    }
    return options;
  }, [products]);

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
        ...warehouses.map((w) => w.name),
        ...products.map((p) => p.warehouse ?? ""),
        getWarehouseName(WAREHOUSE_IDS.production),
        getWarehouseName(WAREHOUSE_IDS.packaging),
        getWarehouseName(WAREHOUSE_IDS.laboratory),
      ]),
    [form.warehouse, warehouses, products]
  );

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
      fetchDeliveryNotes().catch(() => [] as DeliveryNote[]),
      fetchProducts().catch(() => [] as FinishedProduct[]),
      getWarehouses().catch(() => [] as Warehouse[]),
      ifAllowed(canRead("orders"), () => getAllOrders(), [] as Order[]),
    ]).then(([c, s, notes, productRows, warehouseRows, orders]) => {
      setCustomers(c);
      setSuppliers(s);
      setProducts(productRows);
      setWarehouses(warehouseRows);
      setReadyOrders(
        orders.filter(
          (order) =>
            isReadyToShip(order.status) && !isUnsetShipmentCustomer(order.customer)
        )
      );
      const nextNo = nextDocumentNo(
        notes.map((n) => n.noteNo),
        "IRS"
      );
      const base = emptyForm(
        nextNo,
        editing ?? undefined,
        editingLines,
        defaultWarehouseName(warehouseRows, editing?.warehouse || prefill?.warehouse)
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
    });
  }, [open, editing, editingLines, canRead]);

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
      label: order.product
        ? `${order.orderNo} · ${order.customer} · ${order.product}`
        : order.orderNo,
      keywords: `${order.customer} ${order.product} ${order.batchNo ?? ""}`,
    }));
  }, [readyOrders, form.relatedOrderNo, form.party, form.lines, form.issueDate, form.shipDate, form.warehouse]);

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
    const customer = customers.find((row) => row.name === order.customer);
    setForm((f) => ({
      ...f,
      kind: "Satış",
      party: order.customer,
      relatedOrderNo: order.orderNo,
      relatedOrderDate: order.orderDate || f.relatedOrderDate,
      warehouse: order.warehouse?.trim() || f.warehouse,
      dispatchAddress: f.dispatchAddress || order.warehouse?.trim() || f.warehouse,
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
      toast.error("İrsaliye no, alıcı ve depo zorunludur");
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
        toast.success("İrsaliye güncellendi");
        onOpenChange(false);
        onSaved?.(updated);
      } else {
        const created = await createCatalog<DeliveryNote>("delivery-notes", body);
        toast.success("İrsaliye oluşturuldu");
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
      title={editing ? "Sevk irsaliyesini düzenle" : "Yeni sevk irsaliyesi"}
      description="Gönderici bilgisi PDF ayarlarından gelir. Alıcı, gönderim ve irsaliye bilgilerini girin."
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
                  onValueChange={(kind) => setForm((f) => ({ ...f, kind, party: "" }))}
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
                    {warehouseOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Alıcı">
            {form.kind === "Satış" ? (
              <FormField
                label="Sevke hazır iş"
                hint="Siparişi seçince müşteri ve ürün kalemleri otomatik dolar."
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
            ) : null}
            <FormField label="Unvan" required>
              <SearchableSelect
                value={form.party || undefined}
                onValueChange={applyParty}
                placeholder="Alıcı seçin veya arayın"
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

          <FormSection title="Gönderim">
            <FormField label="Gönderim şekli">
              <Select
                value={form.shipMethod}
                onValueChange={(shipMethod) => setForm((f) => ({ ...f, shipMethod }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIP_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FormField label="Şoför adı soyadı" htmlFor="dn-drv" optional>
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
              <FormField label="İrsaliye adresi">
                <SearchableSelect
                  value={form.dispatchAddress || undefined}
                  onValueChange={(dispatchAddress) =>
                    setForm((f) => ({ ...f, dispatchAddress }))
                  }
                  placeholder="Sevk çıkış adresi"
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
              <FormField label="Sevk tarihi" htmlFor="dn-ship" required>
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
              <FormField label="Sipariş no" htmlFor="dn-order" optional>
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
                <Input
                  id="dn-inv"
                  className="bg-white font-mono"
                  value={form.relatedInvoiceNo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      relatedInvoiceNo: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Mallar"
            description={
              form.relatedOrderNo
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
                      placeholder="Mamul seçin veya yazın"
                      searchPlaceholder="Ürün ara veya yaz…"
                      emptyText="Mamul yok, elle yazabilirsiniz"
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
