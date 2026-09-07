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
import { CustomerFormSheet } from "@/components/catalog/customer-form-sheet";
import type { Customer } from "@/data/catalog";
import { deleteCatalog, fetchCustomers } from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";

export default function CustomersPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("customers");
  const [rows, setRows] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const refresh = useCallback(async () => {
    setRows(await fetchCustomers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDelete(row: Customer) {
    if (!window.confirm(`${row.name} silinsin mi?`)) return;
    try {
      const result = await deleteCatalog("customers", row.id);
      toast.success(
        result.deactivated
          ? "Bağlı kayıt var; müşteri pasife alındı"
          : "Müşteri silindi"
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<Customer>[] = [
    { key: "name", header: "Müşteri Adı", render: (r) => r.name },
    { key: "contact", header: "İletişim", render: (r) => r.contact || "—" },
    { key: "address", header: "Adres", render: (r) => r.address || "—" },
    { key: "taxNo", header: "Vergi No", render: (r) => r.taxNo || "—" },
    { key: "email", header: "E-posta", render: (r) => r.email || "—" },
    {
      key: "active",
      header: "Durum",
      render: (r) => (
        <Badge variant={r.active ? "success" : "secondary"}>
          {r.active ? "Aktif" : "Pasif"}
        </Badge>
      ),
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: Customer) => (
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
        badge="Ticari"
        title="Müşteriler"
        description="Müşteri kartları — ekleme, düzenleme ve bağlı kayıt kontrolü ile silme."
        actions={
          <CanWrite resource="customers">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni müşteri
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
              `${r.name} ${r.contact} ${r.address} ${r.taxNo} ${r.email}`
            }
          />
        </CardContent>
      </Card>
      <CustomerFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
