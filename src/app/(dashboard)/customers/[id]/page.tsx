"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { BudgetCashFormSheet } from "@/components/catalog/budget-cash-form-sheet";
import { CustomerFormSheet } from "@/components/catalog/customer-form-sheet";
import { PartyAccountPanel } from "@/components/catalog/party-account-panel";
import type {
  BudgetCashDirection,
  BudgetCashEntry,
  BudgetCategory,
  ChequeNote,
  Customer,
  DeliveryNote,
  Invoice,
  InvoiceEvent,
} from "@/data/catalog";
import {
  fetchBudgetCategories,
  fetchBudgetEntries,
  fetchChequeNotes,
  fetchCustomers,
  fetchDeliveryNotes,
  fetchInvoiceEvents,
  fetchInvoices,
} from "@/lib/catalog-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import { buildPartyAccount, emptyPartyAccount } from "@/lib/party-account";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId);
  const { canRead, canWrite } = useAuth();
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryNote[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashDirection, setCashDirection] = useState<BudgetCashDirection>("gelir");

  const refresh = useCallback(async () => {
    const [
      customers,
      invoiceRows,
      eventRows,
      cashRows,
      chequeRows,
      deliveryRows,
      categoryRows,
    ] = await Promise.all([
      fetchCustomers(),
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("invoices"), () => fetchInvoiceEvents(), [] as InvoiceEvent[]),
      ifAllowed(canRead("budget"), () => fetchBudgetEntries(), [] as BudgetCashEntry[]),
      ifAllowed(canRead("invoices"), () => fetchChequeNotes(), [] as ChequeNote[]),
      ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNotes(), [] as DeliveryNote[]),
      ifAllowed(canRead("budget"), () => fetchBudgetCategories(), [] as BudgetCategory[]),
    ]);
    setCustomer(customers.find((row) => row.id === id) ?? null);
    setInvoices(invoiceRows);
    setEvents(eventRows);
    setCash(cashRows);
    setCheques(chequeRows);
    setDeliveries(deliveryRows);
    setCategories(categoryRows);
  }, [canRead, id]);

  useEffect(() => {
    void refresh().catch(() => setCustomer(null));
  }, [refresh]);

  const account = useMemo(
    () =>
      customer
        ? buildPartyAccount(customer.name, {
            role: "customer",
            invoices,
            events,
            cash,
            cheques,
            deliveries,
          })
        : emptyPartyAccount(),
    [customer, invoices, events, cash, cheques, deliveries]
  );

  if (customer === undefined) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }
  if (!customer) notFound();

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Cari kart"
        title={customer.name}
        description={
          [customer.address, customer.contact, customer.taxNo ? `VKN ${customer.taxNo}` : ""]
            .filter(Boolean)
            .join(" · ") || "Müşteri hesap ekstresi"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/customers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Listeye dön
              </Link>
            </Button>
            {canWrite("customers") ? (
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
        name={customer.name}
        address={customer.address}
        contact={[customer.contact, customer.email].filter(Boolean).join(" · ")}
        active={customer.active}
        account={account}
        empty="Bu müşteride henüz hareket yok"
        avgLabel="Ortalama tahsilat"
        onIncome={() => {
          setCashDirection("gelir");
          setCashOpen(true);
        }}
        onExpense={() => {
          setCashDirection("gider");
          setCashOpen(true);
        }}
      />
      <CustomerFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={customer}
        onSaved={() => void refresh()}
      />
      <BudgetCashFormSheet
        open={cashOpen}
        onOpenChange={setCashOpen}
        direction={cashDirection}
        defaultParty={customer.name}
        lockParty
        categories={categories
          .filter((row) => row.direction === cashDirection)
          .map((row) => row.name)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
