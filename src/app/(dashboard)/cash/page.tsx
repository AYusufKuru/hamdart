"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Landmark, MapPin, Pencil, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { CashAccountFormSheet } from "@/components/catalog/cash-account-form-sheet";
import type { CashAccount } from "@/lib/cash-accounts";
import { currencySymbol, cashLocation, formatIban } from "@/lib/cash-accounts";
import { deleteCashAccount, fetchCashAccounts } from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils";

type TabId = "kasa" | "banka";

function tabFromQuery(value: string | null): TabId {
  return value === "banka" ? "banka" : "kasa";
}

function money(row: Pick<CashAccount, "openingBalance" | "currency">) {
  return `${formatNumber(row.openingBalance)} ${currencySymbol(row.currency)}`;
}

function CashPageContent() {
  const { canWrite } = useAuth();
  const writable = canWrite("budget");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabFromQuery(searchParams.get("tab"));
  const [rows, setRows] = useState<CashAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashAccount | null>(null);
  const [formMode, setFormMode] = useState<"cash" | "bank">("bank");

  const refresh = useCallback(async () => {
    setRows(await fetchCashAccounts());
  }, []);

  useEffect(() => {
    void refresh().catch(() => setRows([]));
  }, [refresh]);

  const kasas = useMemo(() => rows.filter((row) => row.kind === "cash"), [rows]);
  const banks = useMemo(() => rows.filter((row) => row.kind === "bank"), [rows]);
  const kasaTotal = kasas.reduce((sum, row) => sum + row.openingBalance, 0);
  const bankTotal = banks.reduce((sum, row) => sum + row.openingBalance, 0);

  function setTab(next: string) {
    const value = tabFromQuery(next);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "kasa") params.delete("tab");
    else params.set("tab", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function openCreateBank() {
    setFormMode("bank");
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: CashAccount) {
    setFormMode(row.kind === "cash" ? "cash" : "bank");
    setEditing(row);
    setOpen(true);
  }

  async function handleDelete(row: CashAccount) {
    if (!window.confirm(`${row.bankName} / ${row.name} silinsin mi?`)) return;
    try {
      await deleteCashAccount(row.id);
      toast.success("Banka hesabı silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<CashAccount>[] = [
    { key: "bankName", header: "Banka", render: (r) => r.bankName || "—" },
    { key: "name", header: "Hesap adı", render: (r) => r.name },
    {
      key: "iban",
      header: "IBAN",
      render: (r) =>
        r.iban ? (
          <span className="font-mono text-xs">{formatIban(r.iban)}</span>
        ) : (
          "—"
        ),
    },
    { key: "branch", header: "Şube", render: (r) => r.branch || "—" },
    { key: "accountNo", header: "Hesap no", render: (r) => r.accountNo || "—" },
    {
      key: "openingBalance",
      header: "Bakiye",
      className: "text-right",
      render: (r) => (
        <span className="block text-right font-semibold tabular-nums">{money(r)}</span>
      ),
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            render: (r: CashAccount) => (
              <CatalogRowActions onEdit={() => openEdit(r)} onDelete={() => void handleDelete(r)} />
            ),
          } satisfies Column<CashAccount>,
        ]
      : []),
  ];

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Muhasebe"
        title="Kasa"
        description="İstanbul ve Kastamonu kasaları ile şirket banka hesapları."
        actions={
          tab === "banka" ? (
            <CanWrite resource="budget">
              <Button
                className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
                onClick={openCreateBank}
              >
                <Plus className="w-4 h-4 mr-2" />
                Banka hesabı ekle
              </Button>
            </CanWrite>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card border-none">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kasalar
            </p>
            <p className="mt-2 text-2xl font-black text-indigo-700">{formatNumber(kasaTotal)} ₺</p>
            <p className="mt-1 text-xs text-muted-foreground">{kasas.length} kasa</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-none">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Banka hesapları
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-700">{formatNumber(bankTotal)} ₺</p>
            <p className="mt-1 text-xs text-muted-foreground">{banks.length} hesap</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="kasa" className="gap-2">
            <Wallet className="h-4 w-4" />
            Kasa
          </TabsTrigger>
          <TabsTrigger value="banka" className="gap-2">
            <Landmark className="h-4 w-4" />
            Banka
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kasa">
          <div className="grid gap-4 md:grid-cols-2">
            {kasas.map((row) => (
              <Card key={row.id} className="glass-card border-none">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-lg font-black">{row.name}</h2>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {cashLocation(row)}
                      </p>
                    </div>
                    <Badge variant="secondary">Sistem kasası</Badge>
                  </div>
                  <p className="text-3xl font-black tabular-nums">{money(row)}</p>
                  {row.notes ? (
                    <p className="text-sm text-muted-foreground">{row.notes}</p>
                  ) : null}
                  {writable ? (
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Düzenle
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="banka">
          <Card className="glass-card border-none">
            <CardContent className="p-6">
              <SearchTable
                rows={banks}
                columns={columns}
                searchText={(r) =>
                  `${r.bankName} ${r.name} ${r.iban} ${r.branch} ${r.accountNo}`
                }
                empty="Henüz banka hesabı yok. Yeni hesap ekleyin."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CashAccountFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        mode={formMode}
        onSaved={() => void refresh()}
      />
    </div>
  );
}

export default function CashPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Kasa yükleniyor...</div>
      }
    >
      <CashPageContent />
    </Suspense>
  );
}
