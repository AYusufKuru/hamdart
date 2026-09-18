"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  ClipboardCheck,
  FileDown,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { InvoiceFileLinks } from "@/components/catalog/invoice-file-links";
import { InvoiceFormSheet } from "@/components/catalog/invoice-form-sheet";
import { InvoiceProcessDialog } from "@/components/catalog/invoice-process-dialog";
import type { DocumentSettings, Invoice, InvoiceEvent, InvoiceLine } from "@/data/catalog";
import {
  fetchDocumentSettings,
  fetchInvoiceEvents,
  fetchInvoiceLines,
  fetchInvoices,
} from "@/lib/catalog-store";
import { EMPTY_DOCUMENT_SETTINGS } from "@/lib/document-company";
import { useAuth } from "@/lib/auth/auth-context";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import {
  documentTypeFromKind,
  documentTypeMeta,
  invoiceRemaining,
  invoiceStatusVariant,
  normalizeInvoiceStatus,
} from "@/lib/invoice-docs";
import { formatDate, formatNumber } from "@/lib/utils";

function eventWhen(value: string) {
  const iso = value.trim();
  if (!iso) return "—";
  const day = formatDate(iso.slice(0, 10));
  const time = iso.length >= 16 ? iso.slice(11, 16) : "";
  return time ? `${day} ${time}` : day;
}

function money(value: number, currency?: string) {
  return `${formatNumber(value)} ${currency || "₺"}`;
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const { canWrite } = useAuth();
  const writable = canWrite("invoices");
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(EMPTY_DOCUMENT_SETTINGS);
  const [editOpen, setEditOpen] = useState(false);
  const [process, setProcess] = useState<"status" | "payment" | null>(null);

  const refresh = useCallback(async () => {
    const [invoices, invoiceLines, eventRows, company] = await Promise.all([
      fetchInvoices(),
      fetchInvoiceLines(),
      fetchInvoiceEvents().catch(() => [] as InvoiceEvent[]),
      fetchDocumentSettings().catch(() => EMPTY_DOCUMENT_SETTINGS),
    ]);
    const found =
      invoices.find((row) => row.id === id) ??
      invoices.find((row) => row.invoiceNo === id) ??
      null;
    setInvoice(found);
    setLines(found ? invoiceLines.filter((line) => line.invoiceNo === found.invoiceNo) : []);
    setEvents(found ? eventRows.filter((event) => event.invoiceNo === found.invoiceNo) : []);
    setSettings(company);
  }, [id]);

  useEffect(() => {
    void refresh().catch(() => setInvoice(null));
  }, [refresh]);

  const documentType = invoice
    ? documentTypeFromKind(invoice.kind, invoice.documentType)
    : "sales";
  const workflow = invoice ? normalizeInvoiceStatus(invoice.status) : "Proforma";
  const paid = invoice?.paidAmount || 0;
  const remaining = invoice ? invoiceRemaining(invoice.amount, paid) : 0;
  const payments = useMemo(
    () =>
      [...events]
        .filter((event) => event.kind === "payment")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [events]
  );
  const operations = useMemo(
    () => [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [events]
  );
  const paymentRows = useMemo(() => {
    let running = 0;
    return payments.map((event, index) => {
      running = Math.round((running + (event.amount || 0)) * 100) / 100;
      return { ...event, sequence: index + 1, running };
    });
  }, [payments]);

  const lineColumns: Column<InvoiceLine>[] = [
    { key: "description", header: "Açıklama", render: (r) => r.description },
    {
      key: "qty",
      header: "Miktar",
      render: (r) => r.quantityLabel || `${r.quantity} ${r.unit}`,
    },
    {
      key: "unit",
      header: "Birim fiyat",
      className: "text-right",
      render: (r) => formatNumber(r.unitPrice),
    },
    {
      key: "vat",
      header: "KDV",
      className: "text-right",
      render: (r) => (r.vatRate ? `%${r.vatRate}` : "—"),
    },
    {
      key: "total",
      header: "Tutar",
      className: "text-right font-bold",
      render: (r) => formatNumber(r.lineTotal),
    },
  ];

  const paymentColumns: Column<(typeof paymentRows)[number]>[] = [
    {
      key: "sequence",
      header: "#",
      className: "w-10",
      render: (r) => r.sequence,
    },
    {
      key: "createdAt",
      header: "Tarih",
      render: (r) => eventWhen(r.createdAt),
    },
    { key: "method", header: "Yöntem", render: (r) => r.method || "—" },
    {
      key: "amount",
      header: "Tutar",
      className: "text-right font-semibold",
      render: (r) => formatNumber(r.amount),
    },
    {
      key: "running",
      header: "Biriken",
      className: "text-right",
      render: (r) => formatNumber(r.running),
    },
    { key: "status", header: "Sonuç", render: (r) => r.status || "—" },
    { key: "note", header: "Not", render: (r) => r.note || "—" },
    {
      key: "file",
      header: "Dekont",
      render: (r) => <InvoiceFileLinks files={r.fileId ? [r] : []} />,
    },
    { key: "createdBy", header: "Kullanıcı", render: (r) => r.createdBy || "—" },
  ];

  const operationColumns: Column<InvoiceEvent>[] = [
    {
      key: "createdAt",
      header: "Tarih",
      render: (r) => eventWhen(r.createdAt),
    },
    {
      key: "kind",
      header: "İşlem",
      render: (r) => (r.kind === "payment" ? "Kısmi ödeme" : "Durum"),
    },
    {
      key: "status",
      header: "Sonuç",
      render: (r) => r.status || "—",
    },
    {
      key: "amount",
      header: "Tutar",
      className: "text-right",
      render: (r) => (r.kind === "payment" ? formatNumber(r.amount) : "—"),
    },
    { key: "method", header: "Yöntem", render: (r) => r.method || "—" },
    { key: "note", header: "Not", render: (r) => r.note || "—" },
    {
      key: "file",
      header: "Dosya",
      render: (r) => <InvoiceFileLinks files={r.fileId ? [r] : []} />,
    },
    { key: "createdBy", header: "Kullanıcı", render: (r) => r.createdBy || "—" },
  ];

  if (invoice === undefined) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }
  if (!invoice) notFound();

  const typeLabel = documentTypeMeta(documentType).label;
  const paymentLabel = documentType === "purchase" ? "Ödeme kaydet" : "Ödeme al";

  async function handlePdf() {
    try {
      await downloadInvoicePdf(invoice, lines, settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF oluşturulamadı");
    }
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <Button variant="ghost" size="sm" className="rounded-xl" asChild>
        <Link href="/invoices">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Faturalara dön
        </Link>
      </Button>

      <PageHeader
        badge="Fatura detayı"
        title={invoice.invoiceNo}
        description={`${typeLabel} · ${invoice.party}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={invoiceStatusVariant(workflow)}>{workflow}</Badge>
            <Button variant="outline" className="rounded-2xl" onClick={() => void handlePdf()}>
              <FileDown className="mr-2 h-4 w-4" />
              PDF
            </Button>
            {writable ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setProcess("status")}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Durum
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setProcess("payment")}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  {paymentLabel}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Fatura tutarı", value: money(invoice.amount, invoice.currency) },
          { label: "Ödenen", value: money(paid, invoice.currency) },
          { label: "Kalan", value: money(remaining, invoice.currency) },
          { label: "Kısmi ödeme", value: `${payments.length} kayıt` },
        ].map((item) => (
          <Card key={item.label} className="glass-card border-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="space-y-5 p-6">
          <p className="text-sm font-bold">Fatura bilgileri</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Cari" value={invoice.party} />
            <Info label="VKN / TCKN" value={invoice.partyTaxNo} />
            <Info label="Vergi dairesi" value={invoice.partyTaxOffice} />
            <Info label="İl / ilçe" value={[invoice.partyDistrict, invoice.partyCity].filter(Boolean).join(" / ")} />
            <Info label="Düzenleme" value={formatDate(invoice.issueDate)} />
            <Info label="Vade" value={invoice.dueDate ? formatDate(invoice.dueDate) : ""} />
            <Info label="Ödeme şekli" value={invoice.paymentMethod} />
            <Info label="Para birimi" value={invoice.currency || "TRY"} />
            <Info label="İrsaliye no" value={invoice.relatedDispatchNo} />
            <Info label="Sipariş no" value={invoice.relatedOrderNo} />
            <Info label="Ara toplam" value={formatNumber(invoice.subtotal)} />
            <Info label="KDV" value={formatNumber(invoice.totalVat)} />
          </div>
          {invoice.partyAddress ? (
            <Info label="Adres" value={invoice.partyAddress} />
          ) : null}
          {invoice.notes ? <Info label="Not" value={invoice.notes} /> : null}
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-bold">Fatura kalemleri</p>
          <SearchTable
            rows={lines}
            columns={lineColumns}
            searchText={(r) => `${r.description} ${r.unit}`}
            empty="Bu faturada kalem yok"
          />
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Kısmi ödemeler</p>
              <p className="text-sm text-muted-foreground">
                Toplam tahsilat {money(paid, invoice.currency)} · kalan {money(remaining, invoice.currency)}
              </p>
            </div>
            {writable ? (
              <Button size="sm" className="rounded-xl" onClick={() => setProcess("payment")}>
                <Banknote className="mr-1.5 h-4 w-4" />
                {paymentLabel}
              </Button>
            ) : null}
          </div>
          <SearchTable
            rows={paymentRows}
            columns={paymentColumns}
            searchText={(r) => `${r.method} ${r.note} ${r.status} ${r.fileName} ${r.createdBy}`}
            empty="Henüz kısmi ödeme yok"
          />
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-bold">Yapılan işlemler</p>
          <SearchTable
            rows={operations}
            columns={operationColumns}
            searchText={(r) => `${r.kind} ${r.status} ${r.note} ${r.method} ${r.fileName} ${r.createdBy}`}
            empty="Henüz durum veya ödeme işlemi yok"
          />
        </CardContent>
      </Card>

      <InvoiceFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={invoice}
        lockDocumentType
        defaultDocumentType={documentType}
        defaultStatus={invoice.status}
        editingLines={lines}
        onSaved={() => void refresh()}
      />
      <InvoiceProcessDialog
        open={Boolean(process)}
        onOpenChange={(next) => {
          if (!next) setProcess(null);
        }}
        mode={process ?? "status"}
        invoice={invoice}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
