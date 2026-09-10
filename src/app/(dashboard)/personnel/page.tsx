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
import { PersonnelFormSheet } from "@/components/catalog/personnel-form-sheet";
import type { Personnel } from "@/data/catalog";
import { deleteCatalog, fetchPersonnel } from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatNumber } from "@/lib/utils";

export default function PersonnelPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("personnel");
  const [rows, setRows] = useState<Personnel[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Personnel | null>(null);

  const refresh = useCallback(async () => {
    setRows(await fetchPersonnel());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(row: Personnel) {
    if (!window.confirm(`${row.firstName} ${row.lastName} silinsin mi?`)) return;
    try {
      await deleteCatalog("personnel", row.id);
      toast.success("Personel silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<Personnel>[] = [
    { key: "firstName", header: "Ad", render: (r) => r.firstName },
    { key: "lastName", header: "Soyad", render: (r) => r.lastName },
    { key: "department", header: "Departman", render: (r) => r.department },
    { key: "title", header: "Görev", render: (r) => r.title },
    { key: "email", header: "E-posta", render: (r) => r.email || "—" },
    { key: "phone", header: "Telefon", render: (r) => r.phone || "—" },
    {
      key: "hireDate",
      header: "İşe Giriş Tarihi",
      render: (r) => formatDate(r.hireDate),
    },
    ...(writable
      ? [
          {
            key: "salary",
            header: "Maaş (₺)",
            className: "text-right",
            render: (r: Personnel) =>
              r.salary == null ? "—" : formatNumber(r.salary),
          },
          {
            key: "iban",
            header: "IBAN",
            className: "font-mono text-xs",
            render: (r: Personnel) => r.iban || "—",
          },
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: Personnel) => (
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
        badge="İK"
        title="Personel"
        actions={
          <CanWrite resource="personnel">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni personel
            </Button>
          </CanWrite>
        }
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rows}
            columns={columns}
            searchText={(r) =>
              `${r.firstName} ${r.lastName} ${r.department} ${r.title} ${r.email} ${r.phone}`
            }
          />
        </CardContent>
      </Card>
      <PersonnelFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
