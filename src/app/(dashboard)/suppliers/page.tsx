"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import {
  PartyBalanceAmount,
  PartyBalanceStatus,
} from "@/components/catalog/party-balance-cell";
import { SupplierFormSheet } from "@/components/catalog/supplier-form-sheet";
import type { BudgetCashEntry, ChequeNote, Invoice, Supplier } from "@/data/catalog";
import {
  deleteCatalog,
  fetchBudgetEntries,
  fetchChequeNotes,
  fetchInvoices,
  fetchSuppliers,
} from "@/lib/catalog-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { buildPartyAccount, emptyPartyAccount, partyKey } from "@/lib/party-account";

export default function SuppliersPage() {
  const router = useRouter();
  const { canRead, canWrite } = useAuth();
  const writable = canWrite("suppliers");
  const [rows, setRows] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const refresh = useCallback(async () => {
    const [suppliers, invoiceRows, cashRows, chequeRows] = await Promise.all([
      fetchSuppliers(),
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("budget"), () => fetchBudgetEntries(), [] as BudgetCashEntry[]),
      ifAllowed(canRead("invoices"), () => fetchChequeNotes(), [] as ChequeNote[]),
    ]);
    setRows(suppliers);
    setInvoices(invoiceRows);
    setCash(cashRows);
    setCheques(chequeRows);
  }, [canRead]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accounts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildPartyAccount>>();
    for (const row of rows) {
      map.set(
        partyKey(row.name),
        buildPartyAccount(row.name, {
          role: "supplier",
          invoices,
          cash,
          cheques,
          openingBalance: row.openingBalance,
          openingBalanceType: row.openingBalanceType,
          aliases: [row.invoiceName],
        })
      );
    }
    return map;
  }, [rows, invoices, cash, cheques]);

  async function handleDelete(row: Supplier) {
    if (!window.confirm(`${row.name} silinsin mi?`)) return;
    try {
      const result = await deleteCatalog("suppliers", row.id);
      toast.success(
        result.deactivated
          ? "Bağlı sipariş var; tedarikçi pasife alındı"
          : "Tedarikçi silindi"
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Tedarikçi Adı",
      render: (r) => (
        <div>
          <Link
            href={`/suppliers/${encodeURIComponent(r.id)}`}
            className="font-medium text-indigo-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.name}
          </Link>
          {r.active ? null : (
            <p className="text-xs text-muted-foreground">Pasif kart</p>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      header: "İletişim",
      render: (r) => r.mobile || r.contact || r.landline || "—",
    },
    {
      key: "address",
      header: "Adres",
      render: (r) =>
        [r.address, r.district, r.city].filter(Boolean).join(" · ") || "—",
    },
    { key: "taxNo", header: "Vergi No", render: (r) => r.taxNo || r.nationalId || "—" },
    { key: "email", header: "E-posta", render: (r) => r.email || "—" },
    {
      key: "balance",
      header: "Bakiye",
      className: "w-32 max-w-none text-right",
      render: (r) => {
        const account = accounts.get(partyKey(r.name)) ?? emptyPartyAccount();
        return <PartyBalanceAmount balance={account.balance} />;
      },
    },
    {
      key: "balanceStatus",
      header: "Durum",
      className: "w-24 max-w-none",
      render: (r) => {
        const account = accounts.get(partyKey(r.name)) ?? emptyPartyAccount();
        return <PartyBalanceStatus balance={account.balance} />;
      },
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: Supplier) => (
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
        title="Tedarikçiler"
        description="Tedarikçi kartları — bakiye, hesap ekstresi ve doğrudan tahsilat / ödeme."
        actions={
          <CanWrite resource="suppliers">
            <Button
              className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni tedarikçi
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
              `${r.name} ${r.invoiceName} ${r.accountCode} ${r.contact} ${r.mobile} ${r.email} ${r.address} ${r.city} ${r.district} ${r.taxNo} ${r.nationalId}`
            }
            onRowClick={(r) => router.push(`/suppliers/${encodeURIComponent(r.id)}`)}
            empty="Henüz tedarikçi yok"
          />
        </CardContent>
      </Card>
      <SupplierFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
