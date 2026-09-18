"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportsWorkspace } from "@/components/reports/reports-workspace";
import { ChartsWorkspace } from "@/components/reports/charts-workspace";
import type {
  BudgetCashEntry,
  ChequeNote,
  Customer,
  DeliveryNote,
  DeliveryNoteLine,
  Invoice,
  InvoiceEvent,
  InvoiceLine,
  LedgerEntry,
  Supplier,
} from "@/data/catalog";
import type { Order } from "@/data/mock";
import {
  fetchCustomers,
  fetchDeliveryNoteLines,
  fetchDeliveryNotes,
  fetchInvoiceEvents,
  fetchInvoiceLines,
  fetchInvoices,
  fetchLedger,
  fetchSuppliers,
  fetchChequeNotes,
  fetchBudgetEntries,
} from "@/lib/catalog-store";
import { getAllOrders } from "@/lib/order-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import type { ReportsData } from "@/lib/reports";

function emptyData(): ReportsData {
  return {
    invoices: [],
    invoiceLines: [],
    events: [],
    customers: [],
    suppliers: [],
    deliveryNotes: [],
    deliveryLines: [],
    ledger: [],
    orders: [],
    chequeNotes: [],
    budgetCashEntries: [],
  };
}

function ReportsPageContent() {
  const { canRead } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = searchParams.get("tab") === "charts" ? "charts" : "reports";
  const [data, setData] = useState<ReportsData>(emptyData);

  const refresh = useCallback(async () => {
    const [
      invoices,
      invoiceLines,
      events,
      customers,
      suppliers,
      deliveryNotes,
      deliveryLines,
      ledger,
      orders,
      chequeNotes,
      budgetCashEntries,
    ] = await Promise.all([
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("invoices"), () => fetchInvoiceLines(), [] as InvoiceLine[]),
      ifAllowed(canRead("invoices"), () => fetchInvoiceEvents(), [] as InvoiceEvent[]),
      ifAllowed(canRead("customers"), () => fetchCustomers(), [] as Customer[]),
      ifAllowed(canRead("suppliers"), () => fetchSuppliers(), [] as Supplier[]),
      ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNotes(), [] as DeliveryNote[]),
      ifAllowed(canRead("delivery_notes"), () => fetchDeliveryNoteLines(), [] as DeliveryNoteLine[]),
      ifAllowed(canRead("ledger"), () => fetchLedger(), [] as LedgerEntry[]),
      ifAllowed(canRead("orders"), () => getAllOrders(), [] as Order[]),
      ifAllowed(canRead("invoices"), () => fetchChequeNotes(), [] as ChequeNote[]),
      ifAllowed(canRead("budget"), () => fetchBudgetEntries(), [] as BudgetCashEntry[]),
    ]);
    setData({
      invoices,
      invoiceLines,
      events,
      customers,
      suppliers,
      deliveryNotes,
      deliveryLines,
      ledger,
      orders,
      chequeNotes,
      budgetCashEntries,
    });
  }, [canRead]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "reports") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Muhasebe"
        title="Rapor"
        description="Mevcut satış, alış, cari ve evrak kayıtlarından rapor ve bu ayın grafikleri."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="reports" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Rapor
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Grafik
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportsWorkspace data={data} />
        </TabsContent>
        <TabsContent value="charts">
          <ChartsWorkspace data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <ReportsPageContent />
    </Suspense>
  );
}
