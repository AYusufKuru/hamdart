"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { PartyDetailWorkspace } from "@/components/catalog/party-detail-workspace";
import type {
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
  const { canRead } = useAuth();
  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [cash, setCash] = useState<BudgetCashEntry[]>([]);
  const [cheques, setCheques] = useState<ChequeNote[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryNote[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

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

  return (
    <PartyDetailWorkspace
      role="supplier"
      party={supplier}
      account={account}
      categories={categories}
      empty="Bu tedarikçide henüz hareket yok"
      avgLabel="Ortalama ödeme"
      listHref="/suppliers"
      onSaved={() => void refresh()}
    />
  );
}
