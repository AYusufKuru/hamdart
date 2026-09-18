"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { QuoteFormSheet, QuoteStatusDialog } from "@/components/catalog/quote-form-sheet";
import type { DocumentSettings, Invoice, InvoiceLine } from "@/data/catalog";
import {
  deleteCatalog,
  fetchDocumentSettings,
  fetchInvoiceLines,
  fetchInvoices,
} from "@/lib/catalog-store";
import { EMPTY_DOCUMENT_SETTINGS } from "@/lib/document-company";
import { useAuth } from "@/lib/auth/auth-context";
import { downloadQuotePdf } from "@/lib/quote-pdf";
import { documentTypeFromKind, normalizeQuoteStatus } from "@/lib/invoice-docs";
import { formatDate, formatNumber } from "@/lib/utils";

function statusVariant(status: string) {
  const value = normalizeQuoteStatus(status);
  if (value === "Kabul edildi") return "success" as const;
  if (value === "Reddedildi") return "danger" as const;
  if (value === "Gönderildi") return "info" as const;
  return "warning" as const;
}

export function QuotesWorkspace() {
  const { canWrite } = useAuth();
  const writable = canWrite("invoices");
  const [quotes, setQuotes] = useState<Invoice[]>([]);
  const [quoteLines, setQuoteLines] = useState<InvoiceLine[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(EMPTY_DOCUMENT_SETTINGS);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [statusQuote, setStatusQuote] = useState<Invoice | null>(null);

  const refresh = useCallback(async () => {
    const [inv, lines, company] = await Promise.all([
      fetchInvoices(),
      fetchInvoiceLines(),
      fetchDocumentSettings().catch(() => EMPTY_DOCUMENT_SETTINGS),
    ]);
    const onlyQuotes = inv.filter(
      (row) => documentTypeFromKind(row.kind, row.documentType) === "quote"
    );
    setQuotes(onlyQuotes);
    setQuoteLines(lines);
    setSettings(company);
    setSelected((prev) => prev ?? onlyQuotes[0]?.invoiceNo ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lines = useMemo(
    () => quoteLines.filter((l) => l.invoiceNo === selected),
    [quoteLines, selected]
  );

  async function handleDelete(row: Invoice) {
    if (!window.confirm(`${row.invoiceNo} silinsin mi?`)) return;
    try {
      await deleteCatalog("invoices", row.id);
      toast.success("Teklif silindi");
      if (selected === row.invoiceNo) setSelected(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  async function handlePdf(row: Invoice) {
    try {
      const docLines = quoteLines.filter((l) => l.invoiceNo === row.invoiceNo);
      await downloadQuotePdf(row, docLines, settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF oluşturulamadı");
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNo",
      header: "Teklif No",
      className: "font-mono text-sm",
      render: (r) => r.invoiceNo,
    },
    { key: "party", header: "Müşteri", render: (r) => r.party },
    {
      key: "issueDate",
      header: "Tarih",
      render: (r) => formatDate(r.issueDate),
    },
    {
      key: "validUntil",
      header: "Geçerlilik",
      render: (r) => formatDate(r.validUntil || r.dueDate),
    },
    {
      key: "amount",
      header: "Tutar",
      className: "text-right font-bold",
      render: (r) => `${formatNumber(r.amount)} ${r.currency || "₺"}`,
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => (
        <Badge variant={statusVariant(r.status)}>{normalizeQuoteStatus(r.status)}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-36",
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
                  setStatusQuote(r);
                }}
              >
                <ClipboardCheck className="h-4 w-4" />
              </Button>
              <CatalogRowActions onDelete={() => void handleDelete(r)} />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CanWrite resource="invoices">
          <Button
            className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
            onClick={() => setOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni fiyat teklifi
          </Button>
        </CanWrite>
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={quotes}
            columns={columns}
            searchText={(r) =>
              `${r.invoiceNo} ${r.party} ${r.status} ${r.notes} ${r.preparedBy}`
            }
            onRowClick={(r) => setSelected(r.invoiceNo)}
            empty="Henüz fiyat teklifi yok"
          />
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">Seçili teklif kalemleri</p>
            {writable && selected ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  const row = quotes.find((item) => item.invoiceNo === selected);
                  if (row) setStatusQuote(row);
                }}
              >
                <ClipboardCheck className="mr-1.5 h-4 w-4" />
                Durum güncelle
              </Button>
            ) : null}
          </div>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kalemleri görmek için teklif oluşturun.</p>
          ) : (
            <select
              className="h-10 min-w-[16rem] max-w-full rounded-xl border px-3 text-sm bg-background"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {quotes.map((row) => (
                <option key={row.id} value={row.invoiceNo}>
                  {row.invoiceNo} · {row.party}
                </option>
              ))}
            </select>
          )}
          <SearchTable
            rows={lines}
            columns={[
              { key: "description", header: "Ürün / hizmet", render: (r) => r.description },
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
                key: "total",
                header: "Tutar",
                className: "text-right font-bold",
                render: (r) => formatNumber(r.lineTotal),
              },
            ]}
            searchText={(r) => `${r.description} ${r.invoiceNo}`}
            empty="Bu teklifte kalem yok"
          />
        </CardContent>
      </Card>

      <QuoteFormSheet
        open={open}
        onOpenChange={setOpen}
        onSaved={() => void refresh()}
      />
      <QuoteStatusDialog
        open={Boolean(statusQuote)}
        onOpenChange={(next) => {
          if (!next) setStatusQuote(null);
        }}
        quote={statusQuote}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
