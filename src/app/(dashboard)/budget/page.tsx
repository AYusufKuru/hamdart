"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { BudgetFormSheet } from "@/components/catalog/budget-form-sheet";
import type { BudgetRow } from "@/data/catalog";
import { deleteCatalog, fetchBudget } from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils";

export default function BudgetPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("budget");
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | null>(null);

  const refresh = useCallback(async () => {
    setRows(await fetchBudget());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(row: BudgetRow) {
    if (!window.confirm(`${row.department} bütçesi silinsin mi?`)) return;
    try {
      await deleteCatalog("budget", row.id);
      toast.success("Bütçe silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<BudgetRow>[] = [
    { key: "department", header: "Departman", render: (r) => r.department },
    {
      key: "annual",
      header: "Yıllık Bütçe (₺)",
      className: "text-right",
      render: (r) => formatNumber(r.annual),
    },
    {
      key: "spent",
      header: "Harcanan (₺)",
      className: "text-right",
      render: (r) => formatNumber(r.spent),
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: BudgetRow) => (
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
        title="Bütçe"
        description="Departman bütçelerini ekleyin, düzenleyin veya silin."
        actions={
          <CanWrite resource="budget">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni satır
            </Button>
          </CanWrite>
        }
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rows}
            columns={columns}
            searchText={(r) => r.department}
          />
        </CardContent>
      </Card>
      <BudgetFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
