"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  FileText,
  Pencil,
  ScrollText,
  TrendingDown,
  TrendingUp,
  Truck,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { BudgetCashFormSheet } from "@/components/catalog/budget-cash-form-sheet";
import { CustomerFormSheet } from "@/components/catalog/customer-form-sheet";
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
import {
  accountStatusLabel,
  buildPartyAccount,
  emptyPartyAccount,
  moneyTry,
  type PartyStatementLine,
} from "@/lib/party-account";
import { formatDate } from "@/lib/utils";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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

  const status = accountStatusLabel(account.balance);
  const columns: Column<PartyStatementLine>[] = [
    { key: "date", header: "Tarih", render: (r) => formatDate(r.date) },
    {
      key: "docNo",
      header: "Belge no",
      className: "font-mono text-sm",
      render: (r) => r.docNo || "—",
    },
    { key: "kind", header: "Tür", render: (r) => r.kind },
    { key: "description", header: "Açıklama", render: (r) => r.description || "—" },
    {
      key: "debit",
      header: "Borç",
      className: "text-right",
      render: (r) => (r.debit > 0.009 ? moneyTry(r.debit) : "—"),
    },
    {
      key: "credit",
      header: "Alınan",
      className: "text-right",
      render: (r) => (r.credit > 0.009 ? moneyTry(r.credit) : "—"),
    },
    {
      key: "balance",
      header: "Bakiye",
      className: "text-right font-semibold",
      render: (r) => {
        if (Math.abs(r.balance) <= 0.009) return "0,00 ₺";
        return `${moneyTry(Math.abs(r.balance))} (${r.balance > 0 ? "A" : "B"})`;
      },
    },
  ];

  function openCash(direction: BudgetCashDirection) {
    setCashDirection(direction);
    setCashOpen(true);
  }

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

      <Card className="border-none bg-sky-50/80 shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
              <UserRound className="h-8 w-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight">{customer.name}</h2>
                <Badge variant={customer.active ? "success" : "secondary"}>
                  {customer.active ? "Aktif" : "Pasif"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {customer.address || "Adres girilmemiş"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[customer.contact, customer.email].filter(Boolean).join(" · ") || "İletişim yok"}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-sky-100 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
              Hesap durumu
            </p>
            <p
              className={`mt-1 text-2xl font-black ${
                account.balance > 0.009
                  ? "text-emerald-700"
                  : account.balance < -0.009
                    ? "text-rose-700"
                    : "text-sky-900"
              }`}
            >
              {status}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={Truck}
          label="İrsaliye bakiyesi"
          value={
            account.deliveryOpenCount > 0
              ? `${account.deliveryOpenCount} açık irsaliye`
              : "0,00 ₺"
          }
        />
        <SummaryTile icon={Banknote} label="Çek bakiyesi" value={moneyTry(account.chequeOpen)} />
        <SummaryTile icon={ScrollText} label="Senet bakiyesi" value={moneyTry(account.noteOpen)} />
        <SummaryTile
          icon={FileText}
          label="Ortalama tahsilat"
          value={
            account.avgCollectionDays == null
              ? "—"
              : `${account.avgCollectionDays} gün`
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CanWrite resource="budget">
          <Button
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={() => openCash("gelir")}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Tahsilat al
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
            onClick={() => openCash("gider")}
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            Ödeme yap
          </Button>
        </CanWrite>
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-bold">Hesap ekstresi</p>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
          <SearchTable
            rows={account.lines}
            columns={columns}
            searchText={(r) => `${r.date} ${r.docNo} ${r.kind} ${r.description}`}
            empty="Bu müşteride henüz hareket yok"
          />
        </CardContent>
      </Card>

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

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-none bg-white/80 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
