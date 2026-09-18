"use client";

import {
  Banknote,
  FileText,
  ScrollText,
  TrendingDown,
  TrendingUp,
  Truck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import type { PartyAccountSummary, PartyStatementLine } from "@/lib/party-account";
import {
  accountStatusLabel,
  accountToneClass,
  moneyTry,
} from "@/lib/party-account";
import { formatDate } from "@/lib/utils";

const statementColumns: Column<PartyStatementLine>[] = [
  { key: "date", header: "Tarih", render: (r) => (r.date ? formatDate(r.date) : "—") },
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
    className: "text-right tabular-nums",
    render: (r) => (r.debit > 0.009 ? moneyTry(r.debit) : "—"),
  },
  {
    key: "credit",
    header: "Alınan",
    className: "text-right tabular-nums",
    render: (r) => (r.credit > 0.009 ? moneyTry(r.credit) : "—"),
  },
  {
    key: "balance",
    header: "Bakiye",
    className: "text-right tabular-nums font-semibold",
    render: (r) => {
      if (Math.abs(r.balance) <= 0.009) return "0,00 ₺";
      return `${moneyTry(Math.abs(r.balance))} (${r.balance > 0 ? "A" : "B"})`;
    },
  },
];

export function PartyAccountPanel({
  name,
  address,
  contact,
  active,
  account,
  empty,
  avgLabel,
  onIncome,
  onExpense,
}: {
  name: string;
  address?: string;
  contact?: string;
  active: boolean;
  account: PartyAccountSummary;
  empty: string;
  avgLabel: string;
  onIncome: () => void;
  onExpense: () => void;
}) {
  const status = accountStatusLabel(account.balance);
  return (
    <>
      <Card className="border-none bg-sky-50/80 shadow-sm">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
              <UserRound className="h-8 w-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight">{name}</h2>
                <Badge variant={active ? "success" : "secondary"}>
                  {active ? "Aktif" : "Pasif"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {address || "Adres girilmemiş"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{contact || "İletişim yok"}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-sky-100 px-5 py-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
              Hesap durumu
            </p>
            <p className={`mt-1 text-2xl font-black ${accountToneClass(account.balance)}`}>
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
          label={avgLabel}
          value={
            account.avgCollectionDays == null ? "—" : `${account.avgCollectionDays} gün`
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CanWrite resource="budget">
          <Button
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            onClick={onIncome}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Tahsilat al
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
            onClick={onExpense}
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
            columns={statementColumns}
            searchText={(r) => `${r.date} ${r.docNo} ${r.kind} ${r.description}`}
            empty={empty}
          />
        </CardContent>
      </Card>
    </>
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
