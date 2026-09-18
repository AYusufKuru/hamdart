"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { BudgetCashFormSheet } from "@/components/catalog/budget-cash-form-sheet";
import { BudgetCalendar } from "@/components/catalog/budget-calendar";
import { BudgetSettingsButton } from "@/components/catalog/budget-settings-button";
import { ChequeNoteFormSheet } from "@/components/catalog/cheque-note-form-sheet";
import type { BudgetCashDirection, BudgetCashEntry, BudgetCategory, ChequeNote, Invoice } from "@/data/catalog";
import {
  deleteBudgetEntry,
  deleteChequeNote,
  fetchBudgetCategories,
  fetchBudgetEntries,
  fetchChequeNotes,
  fetchInvoices,
} from "@/lib/catalog-store";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  budgetDocumentLabel,
  buildBudgetCalendar,
  isBudgetDocumented,
  isUndocumentedCash,
} from "@/lib/budget-cash";
import { chequeKindLabel } from "@/lib/cheque-notes";
import { formatDate, formatNumber, todayIso } from "@/lib/utils";
import { currentMonthKey, inMonth } from "@/lib/reports";

type TabId = "gelir" | "gider" | "takvim";

function tabFromQuery(value: string | null): TabId {
  if (value === "gider" || value === "takvim") return value;
  return "gelir";
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  return (
    <Card className="glass-card border-none">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function BudgetPageContent() {
  const { canRead, canWrite } = useAuth();
  const writable = canWrite("budget");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabFromQuery(searchParams.get("tab"));
  const [entries, setEntries] = useState<BudgetCashEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [chequeNotes, setChequeNotes] = useState<ChequeNote[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCashEntry | null>(null);
  const [chequeOpen, setChequeOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<ChequeNote | null>(null);
  const [formDirection, setFormDirection] = useState<BudgetCashDirection>("gelir");
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  const refresh = useCallback(async () => {
    const [cash, inv, cheques, cats] = await Promise.all([
      fetchBudgetEntries(),
      ifAllowed(canRead("invoices"), () => fetchInvoices(), [] as Invoice[]),
      ifAllowed(canRead("invoices") || canRead("budget"), () => fetchChequeNotes(), [] as ChequeNote[]),
      fetchBudgetCategories().catch(() => [] as BudgetCategory[]),
    ]);
    setEntries(cash);
    setInvoices(inv);
    setChequeNotes(cheques);
    setCategories(cats);
  }, [canRead]);

  useEffect(() => {
    void refresh().catch(() => {
      setEntries([]);
      setInvoices([]);
      setChequeNotes([]);
      setCategories([]);
    });
  }, [refresh]);

  function setTab(next: string) {
    const value = tabFromQuery(next);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "gelir") params.delete("tab");
    else params.set("tab", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function openCreate(direction: BudgetCashDirection) {
    setFormDirection(direction);
    setEditing(null);
    setOpen(true);
  }

  async function handleDelete(row: BudgetCashEntry) {
    const cheque = chequeNotes.find((item) => item.id === row.id);
    if (!window.confirm(`${row.party} kaydı silinsin mi?`)) return;
    try {
      if (cheque) await deleteChequeNote(cheque.id);
      else await deleteBudgetEntry(row.id);
      toast.success("Kayıt silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const month = currentMonthKey();
  const chequeEntries = useMemo(
    () =>
      chequeNotes.map((note) => ({
        id: note.id,
        direction: (note.direction === "given" ? "gider" : "gelir") as BudgetCashDirection,
        party: note.party,
        category: chequeKindLabel(note.kind),
        amount: note.totalAmount,
        date: note.issueDate,
        dueDate: note.installments[0]?.dueDate ?? "",
        description: note.notes,
        invoiceNo: note.relatedInvoiceNo,
        documented: Boolean(note.relatedInvoiceNo.trim()),
        createdAt: note.createdAt,
        createdBy: note.createdBy,
      })),
    [chequeNotes]
  );
  const gelir = useMemo(
    () =>
      [...entries.filter((row) => row.direction === "gelir"), ...chequeEntries.filter((row) => row.direction === "gelir")].sort(
        (a, b) => b.date.localeCompare(a.date)
      ),
    [entries, chequeEntries]
  );
  const gider = useMemo(
    () =>
      [...entries.filter((row) => row.direction === "gider"), ...chequeEntries.filter((row) => row.direction === "gider")].sort(
        (a, b) => b.date.localeCompare(a.date)
      ),
    [entries, chequeEntries]
  );
  const undocumentedOut = useMemo(
    () => gider.filter((row) => isUndocumentedCash(row)),
    [gider]
  );
  const undocumentedIn = useMemo(
    () => gelir.filter((row) => isUndocumentedCash(row)),
    [gelir]
  );
  const calendarItems = useMemo(
    () => buildBudgetCalendar({ entries, invoices, chequeNotes }),
    [entries, invoices, chequeNotes]
  );

  function columnsFor(direction: BudgetCashDirection): Column<BudgetCashEntry>[] {
    return [
      { key: "date", header: "Tarih", render: (r) => formatDate(r.date) },
      {
        key: "dueDate",
        header: "Vade",
        render: (r) => (r.dueDate ? formatDate(r.dueDate) : "—"),
      },
      { key: "party", header: "Firma", render: (r) => r.party },
      { key: "category", header: "Çeşit", render: (r) => r.category },
      {
        key: "amount",
        header: "Miktar",
        className: "text-right font-bold",
        render: (r) => `${formatNumber(r.amount)} ₺`,
      },
      {
        key: "status",
        header: "Belge",
        render: (r) => (
          <Badge
            variant={
              isBudgetDocumented(r)
                ? "success"
                : budgetDocumentLabel(r) === "Planlandı"
                  ? "info"
                  : "warning"
            }
          >
            {budgetDocumentLabel(r)}
          </Badge>
        ),
      },
      {
        key: "invoiceNo",
        header: "Fatura",
        className: "font-mono text-sm",
        render: (r) => r.invoiceNo || "—",
      },
      {
        key: "description",
        header: "Açıklama",
        render: (r) => r.description || "—",
      },
      ...(writable
        ? [
            {
              key: "actions",
              header: "",
              className: "w-24",
              render: (r: BudgetCashEntry) => (
                <CatalogRowActions
                  onEdit={() => {
                    const cheque = chequeNotes.find((item) => item.id === r.id);
                    if (cheque) {
                      setEditingCheque(cheque);
                      setChequeOpen(true);
                      return;
                    }
                    setFormDirection(direction);
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
  }

  const monthGelir = gelir.filter((row) => inMonth(row.date, month)).reduce((s, r) => s + r.amount, 0);
  const monthGider = gider.filter((row) => inMonth(row.date, month)).reduce((s, r) => s + r.amount, 0);
  const upcomingPay = calendarItems
    .filter((row) => row.direction === "gider" && row.date >= todayIso())
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Muhasebe"
        title="Bütçe"
        description="Kasa gelir-gider hareketleri. Fatura zorunlu değil; fiş veya fatura sonra bağlanır."
        actions={
          <div className="flex flex-wrap gap-2">
            <BudgetSettingsButton writable={writable} onChanged={refresh} />
            {tab !== "takvim" ? (
              <CanWrite resource="budget">
                <Button
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
                  onClick={() => openCreate(tab === "gider" ? "gider" : "gelir")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {tab === "gider" ? "Gider ekle" : "Gelir ekle"}
                </Button>
              </CanWrite>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi
          label="Bu ay gelir"
          value={`${formatNumber(monthGelir)} ₺`}
          hint={`${undocumentedIn.length} belgesiz tahsilat`}
          tone="text-emerald-700"
        />
        <Kpi
          label="Bu ay gider"
          value={`${formatNumber(monthGider)} ₺`}
          hint={`${undocumentedOut.length} belgesiz ödeme`}
          tone="text-rose-700"
        />
        <Kpi
          label="Belgesiz ödemeler"
          value={`${formatNumber(undocumentedOut.reduce((s, r) => s + r.amount, 0))} ₺`}
          hint="Ödeme çıktı, fiş/fatura yok"
          tone="text-amber-700"
        />
        <Kpi
          label="Yaklaşan ödemeler"
          value={`${formatNumber(upcomingPay)} ₺`}
          hint="Açık fatura, çek ve planlanan kasa"
          tone="text-indigo-700"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="gelir" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Gelir
          </TabsTrigger>
          <TabsTrigger value="gider" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Gider
          </TabsTrigger>
          <TabsTrigger value="takvim" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Takvim
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gelir">
          <Card className="glass-card border-none">
            <CardContent className="p-6">
              <SearchTable
                rows={gelir}
                columns={columnsFor("gelir")}
                searchText={(r) =>
                  `${r.party} ${r.category} ${r.description} ${r.invoiceNo} ${budgetDocumentLabel(r)}`
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gider">
          <Card className="glass-card border-none">
            <CardContent className="p-6 space-y-4">
              {undocumentedOut.length > 0 ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm">
                  <span className="font-semibold text-amber-800">Belgesiz ödemeler: </span>
                  kasadan çıktı, henüz fiş veya faturası bağlanmamış {undocumentedOut.length} kayıt /{" "}
                  {formatNumber(undocumentedOut.reduce((s, r) => s + r.amount, 0))} ₺
                </div>
              ) : null}
              <SearchTable
                rows={gider}
                columns={columnsFor("gider")}
                searchText={(r) =>
                  `${r.party} ${r.category} ${r.description} ${r.invoiceNo} ${budgetDocumentLabel(r)}`
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="takvim">
          <BudgetCalendar items={calendarItems} />
        </TabsContent>
      </Tabs>

      <BudgetCashFormSheet
        open={open}
        onOpenChange={setOpen}
        direction={formDirection}
        editing={editing}
        categories={categories
          .filter((row) => row.direction === formDirection)
          .map((row) => row.name)}
        onSaved={() => void refresh()}
      />
      <ChequeNoteFormSheet
        open={chequeOpen}
        onOpenChange={setChequeOpen}
        editing={editingCheque}
        onSaved={() => void refresh()}
      />
    </div>
  );
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <BudgetPageContent />
    </Suspense>
  );
}
