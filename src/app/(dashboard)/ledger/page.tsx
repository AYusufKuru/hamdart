"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { LedgerFormSheet } from "@/components/catalog/ledger-form-sheet";
import type { LedgerEntry } from "@/data/catalog";
import { deleteCatalog, fetchLedger } from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatNumber } from "@/lib/utils";

export default function LedgerPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("ledger");
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);

  const refresh = useCallback(async () => {
    setRows(await fetchLedger());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(row: LedgerEntry) {
    if (!window.confirm(`${row.documentNo} silinsin mi?`)) return;
    try {
      await deleteCatalog("ledger", row.id);
      toast.success("Yevmiye silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<LedgerEntry>[] = [
    { key: "date", header: "İşlem Tarihi", render: (r) => formatDate(r.date) },
    {
      key: "documentNo",
      header: "Belge No",
      className: "font-mono text-sm",
      render: (r) => r.documentNo,
    },
    {
      key: "description",
      header: "İşlem Açıklaması",
      render: (r) => r.description,
    },
    { key: "category", header: "Kategori", render: (r) => r.category },
    { key: "direction", header: "Yön", render: (r) => r.direction },
    {
      key: "amount",
      header: "Tutar (₺)",
      className: "text-right font-bold",
      render: (r) => formatNumber(r.amount),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <Badge variant="success">{r.status}</Badge>,
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: LedgerEntry) => (
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
        badge="Muhasebe"
        title="Yevmiye Defteri"
        description="Yevmiye kayıtlarını ekleyin, düzenleyin veya silin."
        actions={
          <CanWrite resource="ledger">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni kayıt
            </Button>
          </CanWrite>
        }
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rows}
            columns={columns}
            searchText={(r) => `${r.documentNo} ${r.description} ${r.category}`}
          />
        </CardContent>
      </Card>
      <LedgerFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
