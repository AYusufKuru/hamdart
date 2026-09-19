"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { PartyDetailWorkspace } from "@/components/catalog/party-detail-workspace";
import type {
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
  const { canRead } = useAuth();
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryNote[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

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
            openingBalance: customer.openingBalance,
            openingBalanceType: customer.openingBalanceType,
            aliases: [customer.invoiceName],
          })
        : emptyPartyAccount(),
    [customer, invoices, events, cash, cheques, deliveries]
  );

  if (customer === undefined) {
    return <div className="p-10 text-muted-foreground">Yükleniyor...</div>;
  }
  if (!customer) notFound();

  return (
    <PartyDetailWorkspace
      role="customer"
      party={customer}
      account={account}
      categories={categories}
      empty="Bu müşteride henüz hareket yok"
      avgLabel="Ortalama tahsilat"
      listHref="/customers"
      onSaved={() => void refresh()}
    />
  );
}
