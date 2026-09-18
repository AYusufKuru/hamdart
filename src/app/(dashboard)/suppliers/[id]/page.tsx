"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { BudgetCashFormSheet } from "@/components/catalog/budget-cash-form-sheet";
import { PartyAccountPanel } from "@/components/catalog/party-account-panel";
import { SupplierFormSheet } from "@/components/catalog/supplier-form-sheet";
import type {
  BudgetCashDirection,
  BudgetCashEntry,
  BudgetCategory,
  ChequeNote,
  DeliveryNote,
  Invoice,
  InvoiceEvent,
  Supplier,
} from "@/data/catalog";
import {
  fetchBudgetCategories,
  fetchBudgetEntries,
  fetchChequeNotes,
  fetchDeliveryNotes,
  fetchInvoiceEvents,
  fetchInvoices,
  fetchSuppliers,
} from "@/lib/catalog-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { buildPartyAccount, emptyPartyAccount } from "@/lib/party-account";

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const { canRead, canWrite } = useAuth();
  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryNote[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashDirection, setCashDirection] = useState<BudgetCashDirection>("gider");

  const refresh = useCallback(async () => {
    const [
      suppliers,
      invoiceRows,
      eventRows,
      cashRows,
      chequeRows,
      deliveryRows,
      categoryRows,
    ] = await Promise.all([
      fetchSuppliers(),
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("invoices"), () => fetchInvoiceEvents(), [] as InvoiceEvent[]),
      ifAllowed(canRead("budget"), () => fetchBudgetEntries(), [] as BudgetCashEntry[]),
      ifAllowed(canRead("invoices"), () => fetchChequeNotes(), [] as ChequeNote[]),
      ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNotes(), [] as DeliveryNote[]),
      ifAllowed(canRead("budget"), () => fetchBudgetCategories(), [] as BudgetCategory[]),
    ]);
    setSupplier(suppliers.find((row) => row.id === id) ?? null);
    setInvoices(invoiceRows);
    setEvents(eventRows);
    setCash(cashRows);
    setCheques(chequeRows);
    setDeliveries(deliveryRows);
    setCategories(categoryRows);
  }, [canRead, id]);

  useEffect(() => {
    void refresh().catch(() => setSupplier(null));
  }, [refresh]);

  const account = useMemo(
    () =>
      supplier
        ? buildPartyAccount(supplier.name, {
            role: "supplier",
            invoices,
            events,
            cash,
            cheques,
            deliveries,
            openingBalance: supplier.openingBalance,
            openingBalanceType: supplier.openingBalanceType,
            aliases: [supplier.invoiceName],
          })
        : emptyPartyAccount(),
    [supplier, invoices, events, cash, cheques, deliveries]
  );

  if (supplier === undefined) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }
  if (!supplier) notFound();

  const address =
    [supplier.address, supplier.district, supplier.city, supplier.country]
      .filter(Boolean)
      .join(" · ") || undefined;
  const contact = [supplier.mobile || supplier.contact, supplier.email, supplier.taxNo]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Cari kart"
        title={supplier.name}
        description={
          [supplier.invoiceName !== supplier.name ? supplier.invoiceName : "", address, supplier.accountCode]
            .filter(Boolean)
            .join(" · ") || "Tedarikçi hesap ekstresi"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/suppliers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Listeye dön
              </Link>
            </Button>
            {canWrite("suppliers") ? (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Kartı düzenle
              </Button>
            ) : null}
          </div>
        }
      />
      <PartyAccountPanel
        name={supplier.name}
        address={address}
        contact={contact}
        active={supplier.active}
        account={account}
        empty="Bu tedarikçide henüz hareket yok"
        avgLabel="Ortalama ödeme"
        onIncome={() => {
          setCashDirection("gelir");
          setCashOpen(true);
        }}
        onExpense={() => {
          setCashDirection("gider");
          setCashOpen(true);
        }}
      />
      <SupplierFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={supplier}
        onSaved={() => void refresh()}
      />
      <BudgetCashFormSheet
        open={cashOpen}
        onOpenChange={setCashOpen}
        direction={cashDirection}
        defaultParty={supplier.name}
        lockParty
        categories={categories
          .filter((row) => row.direction === cashDirection)
          .map((row) => row.name)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
