"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { InvoiceFormSheet } from "@/components/catalog/invoice-form-sheet";
import type { Invoice, InvoiceLine } from "@/data/catalog";
import {
  deleteCatalog,
  fetchInvoiceLines,
  fetchInvoices,
} from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatNumber } from "@/lib/utils";

export default function InvoicesPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const refresh = useCallback(async () => {
    const [inv, lines] = await Promise.all([
      fetchInvoices(),
      fetchInvoiceLines(),
    ]);
    setInvoices(inv);
    setInvoiceLines(lines);
    setSelected((prev) => prev ?? inv[0]?.invoiceNo ?? null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lines = useMemo(
    () => invoiceLines.filter((l) => l.invoiceNo === selected),
    [invoiceLines, selected]
  );

  async function handleDelete(row: Invoice) {
    if (!window.confirm(`${row.invoiceNo} silinsin mi?`)) return;
    try {
      await deleteCatalog("invoices", row.id);
      toast.success("Fatura silindi");
      if (selected === row.invoiceNo) setSelected(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNo",
      header: "Fatura No",
      className: "font-mono text-sm",
      render: (r) => r.invoiceNo,
    },
    { key: "party", header: "Müşteri / Tedarikçi", render: (r) => r.party },
    { key: "kind", header: "Tür", render: (r) => r.kind },
    {
      key: "issueDate",
      header: "Düzenleme Tarihi",
      render: (r) => formatDate(r.issueDate),
    },
    {
      key: "dueDate",
      header: "Vade Tarihi",
      render: (r) => formatDate(r.dueDate),
    },
    {
      key: "amount",
      header: "Tutar (₺)",
      className: "text-right font-bold",
      render: (r) => formatNumber(r.amount),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <Badge variant="warning">{r.status}</Badge>,
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: Invoice) => (
              <CatalogRowActions
                onEdit={() => {
                  setEditing(r);
                  setOpen(true);
                }}
                onDelete={() => void handleDelete(r)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Cari"
        title="Cari Açık"
        description="Faturalar ve kalemleri."
        actions={
          <CanWrite resource="invoices">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni fatura
            </Button>
          </CanWrite>
        }
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={invoices}
            columns={columns}
            searchText={(r) => `${r.invoiceNo} ${r.party} ${r.status}`}
            onRowClick={(r) => setSelected(r.invoiceNo)}
          />
        </CardContent>
      </Card>
      <Card className="glass-card border-none">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm font-bold">Cari Fatura Kalemleri</p>
          <select
            className="h-10 rounded-xl border px-3 text-sm bg-background"
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.invoiceNo}>
                {inv.invoiceNo}
              </option>
            ))}
          </select>
          <SearchTable
            rows={lines}
            columns={[
              {
                key: "invoiceNo",
                header: "Fatura No",
                render: (r) => r.invoiceNo,
              },
              {
                key: "description",
                header: "Kalem Açıklaması",
                render: (r) => r.description,
              },
              { key: "qty", header: "Miktar", render: (r) => r.quantityLabel },
              {
                key: "unit",
                header: "Birim Fiyat (₺)",
                className: "text-right",
                render: (r) => formatNumber(r.unitPrice),
              },
              {
                key: "total",
                header: "Kalem Toplam (₺)",
                className: "text-right font-bold",
                render: (r) => formatNumber(r.lineTotal),
              },
            ]}
            searchText={(r) => `${r.description} ${r.invoiceNo}`}
            empty="Bu faturada kalem yok"
          />
        </CardContent>
      </Card>
      <InvoiceFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        editingLines={
          editing
            ? invoiceLines.filter((l) => l.invoiceNo === editing.invoiceNo)
            : []
        }
        onSaved={() => void refresh()}
      />
    </div>
  );
}
