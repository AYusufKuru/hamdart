"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BadgePercent, Banknote, ClipboardCheck, FileDown, FileSpreadsheet, Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { InvoiceFileLinks } from "@/components/catalog/invoice-file-links";
import { InvoiceFormSheet } from "@/components/catalog/invoice-form-sheet";
import { InvoiceProcessDialog } from "@/components/catalog/invoice-process-dialog";
import { ChequeNotesWorkspace } from "@/components/catalog/cheque-notes-workspace";
import { PdfSettingsButton } from "@/components/catalog/pdf-settings-button";
import { QuotesWorkspace } from "@/components/catalog/quotes-workspace";
import { DeliveryNotesWorkspace } from "@/components/catalog/delivery-notes-workspace";
import type { DocumentSettings, Invoice, InvoiceEvent, InvoiceLine } from "@/data/catalog";
import {
  deleteCatalog,
  fetchDocumentSettings,
  fetchInvoiceEvents,
  fetchInvoiceLines,
  fetchInvoices,
} from "@/lib/catalog-store";
import { EMPTY_DOCUMENT_SETTINGS } from "@/lib/document-company";
import { useAuth } from "@/lib/auth/auth-context";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import {
  bucketFor,
  documentTypeFromKind,
  documentTypeMeta,
  INVOICE_PAGE_FILTERS,
  INVOICE_STATUS_FILTERS,
  invoiceStatusVariant,
  isInvoicePageType,
  normalizeInvoiceStatus,
  type InvoiceDocumentType,
  type InvoicePageFilter,
  type InvoiceStatusFilter,
} from "@/lib/invoice-docs";
import { formatDate, formatNumber } from "@/lib/utils";

function createConfig(filter: InvoicePageFilter): {
  type: InvoiceDocumentType;
  status: string;
  label: string;
} {
  if (filter === "purchase") return { type: "purchase", status: "Ödenmedi", label: "Yeni alış faturası" };
  if (filter === "confirmed") return { type: "sales", status: "Onaylandı", label: "Yeni gerçekleşen fatura" };
  return { type: "sales", status: "Ödenmedi", label: "Yeni satış faturası" };
}

type DocumentTab = "invoices" | "quotes" | "delivery";

const DOCUMENT_TABS: { value: DocumentTab; label: string; icon: typeof FileSpreadsheet }[] = [
  { value: "invoices", label: "Faturalar", icon: FileSpreadsheet },
  { value: "quotes", label: "Fiyat teklifi", icon: BadgePercent },
  { value: "delivery", label: "Sevk irsaliyesi", icon: Truck },
];

function documentTabFromQuery(value: string | null, allowDelivery: boolean): DocumentTab {
  if (value === "quotes") return "quotes";
  if (value === "delivery" && allowDelivery) return "delivery";
  return "invoices";
}

function InvoicesPageContent() {
  const { canWrite, canRead } = useAuth();
  const writable = canWrite("invoices");
  const allowDelivery = canRead("delivery_notes");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const docTab = documentTabFromQuery(searchParams.get("tab"), allowDelivery);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(EMPTY_DOCUMENT_SETTINGS);
  const [open, setOpen] = useState(false);
  const [chequeOpen, setChequeOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [process, setProcess] = useState<{ mode: "status" | "payment"; invoice: Invoice } | null>(null);
  const [filter, setFilter] = useState<InvoicePageFilter>("sales");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");

  useEffect(() => {
    if (filter !== "cheque") setChequeOpen(false);
  }, [filter]);

  const refresh = useCallback(async () => {
    const [inv, lines, company, ev] = await Promise.all([
      fetchInvoices(),
      fetchInvoiceLines(),
      fetchDocumentSettings().catch(() => EMPTY_DOCUMENT_SETTINGS),
      fetchInvoiceEvents().catch(() => [] as InvoiceEvent[]),
    ]);
    setInvoices(inv);
    setInvoiceLines(lines);
    setSettings(company);
    setEvents(ev);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resolved = useMemo(
    () =>
      invoices
        .map((row) => {
          const documentType = documentTypeFromKind(row.kind, row.documentType);
          const bucket = bucketFor(documentType, row.bucket);
          const workflow = normalizeInvoiceStatus(row.status);
          return { ...row, documentType, bucket, workflow, paidAmount: row.paidAmount ?? 0 };
        })
        .filter((row) => isInvoicePageType(row.documentType)),
    [invoices]
  );

  const byType = useMemo(() => {
    return resolved.filter((row) => {
      if (filter === "cheque") return false;
      if (filter === "purchase") return row.documentType === "purchase";
      if (filter === "sales") {
        return (
          row.documentType === "sales" ||
          row.documentType === "cash_sale" ||
          row.documentType === "return" ||
          row.documentType === "proforma"
        );
      }
      return row.confirmed && row.workflow !== "Proforma" && row.workflow !== "Reddedildi" && row.workflow !== "İptal Edildi";
    });
  }, [resolved, filter]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return byType;
    return byType.filter((row) => row.workflow === statusFilter);
  }, [byType, statusFilter]);

  const filesByInvoice = useMemo(() => {
    const map = new Map<string, InvoiceEvent[]>();
    for (const event of events) {
      if (!event.fileId) continue;
      const list = map.get(event.invoiceNo) ?? [];
      list.push(event);
      map.set(event.invoiceNo, list);
    }
    return map;
  }, [events]);

  const create = createConfig(filter);
  const filterLabel = INVOICE_PAGE_FILTERS.find((f) => f.value === filter)?.label ?? "Satış";

  function setDocTab(next: string) {
    const tab = documentTabFromQuery(next, allowDelivery);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "invoices") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const header =
    docTab === "quotes"
      ? {
          title: "Fiyat teklifi",
          description: "Müşteriye özel teklifler. Fatura sayfasından açılır, PDF olarak indirilir.",
        }
      : docTab === "delivery"
        ? {
            title: "Sevk irsaliyesi",
            description: "Satış sevk ve mal kabul irsaliyeleri. Fatura yerine geçmez; PDF çıktısı alınır.",
          }
        : {
            title: filter === "cheque" ? "Çek / Senet" : "Faturalar",
            description:
              filter === "cheque"
                ? "Alınan ve verilen çek / senetler."
                : `${filterLabel} faturaları. Durum ve tahsilat bu sayfadan güncellenir.`,
          };

  async function handleDelete(row: Invoice) {
    if (!window.confirm(`${row.invoiceNo} silinsin mi?`)) return;
    try {
      await deleteCatalog("invoices", row.id);
      toast.success("Fatura silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  async function handlePdf(row: Invoice) {
    try {
      const docLines = invoiceLines.filter((l) => l.invoiceNo === row.invoiceNo);
      await downloadInvoicePdf(row, docLines, settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF oluşturulamadı");
    }
  }

  const columns: Column<(typeof resolved)[number]>[] = [
    {
      key: "invoiceNo",
      header: "Fatura No",
      className: "font-mono text-sm",
      render: (r) => (
        <span className="font-semibold text-indigo-600">{r.invoiceNo}</span>
      ),
    },
    {
      key: "kind",
      header: "Tür",
      render: (r) => documentTypeMeta(r.documentType).label,
    },
    { key: "party", header: "Cari", render: (r) => r.party },
    {
      key: "issueDate",
      header: "Tarih",
      render: (r) => formatDate(r.issueDate),
    },
    {
      key: "amount",
      header: "Tutar",
      className: "text-right font-bold",
      render: (r) => `${formatNumber(r.amount)} ${r.currency || "₺"}`,
    },
    {
      key: "paid",
      header: "Ödenen",
      className: "text-right",
      render: (r) => formatNumber(r.paidAmount || 0),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <Badge variant={invoiceStatusVariant(r.workflow)}>{r.workflow}</Badge>,
    },
    {
      key: "files",
      header: "Dosya",
      render: (r) => <InvoiceFileLinks files={filesByInvoice.get(r.invoiceNo) ?? []} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-44",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="PDF indir"
            onClick={(e) => {
              e.stopPropagation();
              void handlePdf(r);
            }}
          >
            <FileDown className="h-4 w-4" />
          </Button>
          {writable ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Durum güncelle"
                onClick={(e) => {
                  e.stopPropagation();
                  setProcess({ mode: "status", invoice: r });
                }}
              >
                <ClipboardCheck className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Ödeme al"
                onClick={(e) => {
                  e.stopPropagation();
                  setProcess({ mode: "payment", invoice: r });
                }}
              >
                <Banknote className="h-4 w-4" />
              </Button>
              <CatalogRowActions
                onEdit={() => {
                  setEditing(r);
                  setOpen(true);
                }}
                onDelete={() => void handleDelete(r)}
              />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Muhasebe"
        title={header.title}
        description={header.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <PdfSettingsButton />
            {docTab === "invoices" ? (
              <CanWrite resource="invoices">
                {filter === "cheque" ? (
                  <Button
                    className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
                    onClick={() => setChequeOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Yeni çek / senet
                  </Button>
                ) : (
                  <Button
                    className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
                    onClick={() => {
                      setEditing(null);
                      setOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {create.label}
                  </Button>
                )}
              </CanWrite>
            ) : null}
          </div>
        }
      />

      <Tabs value={docTab} onValueChange={setDocTab}>
        <TabsList className="h-auto flex-wrap">
          {DOCUMENT_TABS.filter((item) => item.value !== "delivery" || allowDelivery).map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="gap-2">
              <item.icon className="h-4 w-4" />
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {INVOICE_PAGE_FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => {
              setFilter(item.value);
              setStatusFilter("all");
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {filter === "cheque" ? (
        <ChequeNotesWorkspace
          writable={writable}
          createOpen={chequeOpen}
          onCreateOpenChange={setChequeOpen}
        />
      ) : (
        <>
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={filtered}
            columns={columns}
            searchText={(r) =>
              `${r.invoiceNo} ${r.party} ${r.status} ${r.kind} ${r.documentType} ${r.partyTaxNo} ${(
                filesByInvoice.get(r.invoiceNo) ?? []
              )
                .map((file) => file.fileName)
                .join(" ")}`
            }
            onRowClick={(r) => router.push(`/invoices/${encodeURIComponent(r.id)}`)}
            empty="Bu görünümde fatura yok"
            toolbar={
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-muted-foreground">Durum</span>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as InvoiceStatusFilter)}
                >
                  <SelectTrigger className="h-10 w-52 rounded-xl bg-white">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUS_FILTERS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          />
        </CardContent>
      </Card>
        </>
      )}

      <InvoiceFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        lockDocumentType={!editing}
        defaultDocumentType={create.type}
        defaultStatus={create.status}
        editingLines={
          editing
            ? invoiceLines.filter((l) => l.invoiceNo === editing.invoiceNo)
            : []
        }
        onSaved={() => void refresh()}
      />
      <InvoiceProcessDialog
        open={Boolean(process)}
        onOpenChange={(next) => {
          if (!next) setProcess(null);
        }}
        mode={process?.mode ?? "status"}
        invoice={process?.invoice ?? null}
        onSaved={() => void refresh()}
      />
        </TabsContent>

        <TabsContent value="quotes">
          <QuotesWorkspace />
        </TabsContent>

        {allowDelivery ? (
          <TabsContent value="delivery">
            <DeliveryNotesWorkspace />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
