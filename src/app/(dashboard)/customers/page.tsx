"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { CustomerFormSheet } from "@/components/catalog/customer-form-sheet";
import type { BudgetCashEntry, ChequeNote, Customer, Invoice } from "@/data/catalog";
import {
  deleteCatalog,
  fetchBudgetEntries,
  fetchChequeNotes,
  fetchCustomers,
  fetchInvoices,
} from "@/lib/catalog-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  accountStatusLabel,
  buildPartyAccountMap,
  emptyPartyAccount,
  partyKey,
} from "@/lib/party-account";

export default function CustomersPage() {
  const router = useRouter();
  const { canRead, canWrite } = useAuth();
  const writable = canWrite("customers");
  const [rows, setRows] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const refresh = useCallback(async () => {
    const [customers, invoiceRows, cashRows, chequeRows] = await Promise.all([
      fetchCustomers(),
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("budget"), () => fetchBudgetEntries(), [] as BudgetCashEntry[]),
      ifAllowed(canRead("invoices"), () => fetchChequeNotes(), [] as ChequeNote[]),
    ]);
    setRows(customers);
    setInvoices(invoiceRows);
    setCash(cashRows);
    setCheques(chequeRows);
  }, [canRead]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accounts = useMemo(
    () =>
      buildPartyAccountMap(
        rows.map((row) => row.name),
        { invoices, cash, cheques }
      ),
    [rows, invoices, cash, cheques]
  );

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
    {
      key: "name",
      header: "Müşteri Adı",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          {r.active ? null : (
            <p className="text-xs text-muted-foreground">Pasif kart</p>
          )}
        </div>
      ),
    },
    { key: "contact", header: "İletişim", render: (r) => r.contact || "—" },
    { key: "address", header: "Adres", render: (r) => r.address || "—" },
    { key: "taxNo", header: "Vergi No", render: (r) => r.taxNo || "—" },
    { key: "email", header: "E-posta", render: (r) => r.email || "—" },
    {
      key: "balance",
      header: "Bakiye",
      className: "text-right",
      render: (r) => {
        const account = accounts.get(partyKey(r.name)) ?? emptyPartyAccount();
        const label = accountStatusLabel(account.balance);
        const className =
          account.balance > 0.009
            ? "font-semibold text-emerald-700"
            : account.balance < -0.009
              ? "font-semibold text-rose-700"
              : "text-muted-foreground";
        return <span className={className}>{label}</span>;
      },
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
        description="Müşteri kartları — bakiye, hesap ekstresi ve doğrudan tahsilat / ödeme."
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
            onRowClick={(r) => router.push(`/customers/${r.id}`)}
            empty="Henüz müşteri yok"
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
