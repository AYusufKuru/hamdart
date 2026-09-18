import type {
  BudgetCashDirection,
  BudgetCashEntry,
  ChequeNote,
  Invoice,
  LedgerEntry,
} from "@/data/catalog";
import {
  documentTypeFromKind,
  isConfirmedWorkflow,
  normalizeInvoiceStatus,
} from "@/lib/invoice-docs";
import { chequeKindLabel, flattenChequeInstallments } from "@/lib/cheque-notes";
import { plusDaysIso, todayIso } from "@/lib/utils";

export const BUDGET_INCOME_CATEGORIES = [
  "Satış tahsilatı",
  "Hizmet",
  "Kira",
  "Çek",
  "Senet",
  "Diğer gelir",
] as const;

export const BUDGET_EXPENSE_CATEGORIES = [
  "Kasa avansı",
  "Market",
  "Çay / kahve",
  "Ulaşım",
  "Fatura",
  "Maaş",
  "Diğer gider",
] as const;

export function isBudgetDocumented(row: Pick<BudgetCashEntry, "documented" | "invoiceNo">) {
  return row.documented || Boolean(row.invoiceNo.trim());
}

export function isBudgetRealized(row: Pick<BudgetCashEntry, "date">, today = todayIso()) {
  return row.date <= today;
}

export function isUndocumentedCash(row: BudgetCashEntry, today = todayIso()) {
  return !isBudgetDocumented(row) && isBudgetRealized(row, today);
}

export function budgetDocumentLabel(row: Pick<BudgetCashEntry, "documented" | "invoiceNo" | "date">) {
  if (isBudgetDocumented(row)) return "Belgelendi";
  if (!isBudgetRealized(row)) return "Planlandı";
  return "Belgesiz";
}

export function budgetDirectionLabel(direction: BudgetCashDirection | string) {
  return direction === "gider" ? "Gider" : "Gelir";
}

export type BudgetCalendarSource = "kasa" | "fatura" | "cek";
export type BudgetCalendarBucket = "overdue" | "approaching" | "upcoming";

export type BudgetCalendarItem = {
  id: string;
  date: string;
  direction: BudgetCashDirection;
  source: BudgetCalendarSource;
  party: string;
  amount: number;
  title: string;
  note: string;
  documented?: boolean;
};

function invoiceRemaining(row: Invoice) {
  return Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0));
}

function isVoidInvoice(row: Invoice) {
  const status = normalizeInvoiceStatus(row.status);
  return status === "İptal Edildi" || status === "Reddedildi";
}

function invoiceDirection(row: Invoice): BudgetCashDirection | null {
  const type = documentTypeFromKind(row.kind, row.documentType);
  if (type === "sales" || type === "cash_sale") return "gelir";
  if (type === "purchase" || type === "return") return "gider";
  return null;
}

export type BudgetListSource = BudgetCalendarSource | "yevmiye";

export type BudgetListRow = BudgetCashEntry & {
  source: BudgetListSource;
  href?: string;
};

export function budgetListSourceLabel(source: BudgetListSource) {
  if (source === "fatura") return "Fatura";
  if (source === "cek") return "Çek / Senet";
  if (source === "yevmiye") return "Yevmiye";
  return "Kasa";
}

export function isBudgetListEditable(row: BudgetListRow) {
  return row.source === "kasa" || row.source === "cek";
}

function invoiceCategory(row: Invoice) {
  const type = documentTypeFromKind(row.kind, row.documentType);
  if (type === "cash_sale") return "Peşin satış";
  if (type === "purchase") return "Alış faturası";
  if (type === "return") return "İade";
  return "Satış faturası";
}

function invoiceBudgetRows(invoices: Invoice[]): BudgetListRow[] {
  const rows: BudgetListRow[] = [];
  for (const row of invoices) {
    if (isVoidInvoice(row) || !isConfirmedWorkflow(row.status)) continue;
    const direction = invoiceDirection(row);
    if (!direction) continue;
    const amount = Number(row.amount) || 0;
    if (amount <= 0.009) continue;
    rows.push({
      id: `inv-${row.id}`,
      direction,
      party: row.party,
      category: invoiceCategory(row),
      amount,
      date: row.issueDate,
      dueDate: row.dueDate,
      description: row.notes,
      invoiceNo: row.invoiceNo,
      documented: true,
      createdAt: row.issueDate,
      createdBy: row.preparedBy || "",
      source: "fatura",
      href: `/invoices/${row.id}`,
    });
  }
  return rows;
}

function ledgerBudgetRows(ledger: LedgerEntry[]): BudgetListRow[] {
  const rows: BudgetListRow[] = [];
  for (const row of ledger) {
    if (row.status === "İptal") continue;
    const amount = Number(row.amount) || 0;
    if (amount <= 0.009) continue;
    const direction: BudgetCashDirection | null =
      row.direction === "Girdi" ? "gelir" : row.direction === "Çıktı" ? "gider" : null;
    if (!direction) continue;
    rows.push({
      id: `led-${row.id}`,
      direction,
      party: row.category || row.description || "Yevmiye",
      category: row.category || "Yevmiye",
      amount,
      date: row.date,
      dueDate: "",
      description: row.description,
      invoiceNo: row.documentNo,
      documented: true,
      createdAt: row.date,
      createdBy: "",
      source: "yevmiye",
    });
  }
  return rows;
}

function cashBudgetRows(entries: BudgetCashEntry[]): BudgetListRow[] {
  return entries.map((row) => ({ ...row, source: "kasa" as const }));
}

function chequeBudgetRows(chequeNotes: ChequeNote[]): BudgetListRow[] {
  return chequeNotes.map((note) => ({
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
    source: "cek" as const,
  }));
}

function linkedDocNo(row: Pick<BudgetListRow, "invoiceNo">) {
  return row.invoiceNo.trim();
}

export function buildBudgetLists(input: {
  entries: BudgetCashEntry[];
  invoices: Invoice[];
  chequeNotes: ChequeNote[];
  ledger?: LedgerEntry[];
}): { gelir: BudgetListRow[]; gider: BudgetListRow[] } {
  const invoices = invoiceBudgetRows(input.invoices);
  const invoiceNos = new Set(invoices.map(linkedDocNo).filter(Boolean));
  const skipLinked = (row: BudgetListRow) => {
    const doc = linkedDocNo(row);
    return !doc || !invoiceNos.has(doc);
  };
  const all = [
    ...invoices,
    ...ledgerBudgetRows(input.ledger ?? []).filter(skipLinked),
    ...cashBudgetRows(input.entries).filter(skipLinked),
    ...chequeBudgetRows(input.chequeNotes).filter(skipLinked),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.party.localeCompare(b.party, "tr"));
  return {
    gelir: all.filter((row) => row.direction === "gelir"),
    gider: all.filter((row) => row.direction === "gider"),
  };
}

export function calendarBucket(due: string, today = todayIso()): BudgetCalendarBucket {
  if (!due || due < today) return "overdue";
  if (due <= plusDaysIso(7)) return "approaching";
  return "upcoming";
}

export function sourceLabel(source: BudgetCalendarSource) {
  if (source === "fatura") return "Fatura";
  if (source === "cek") return "Çek / Senet";
  return "Kasa";
}

export function buildBudgetCalendar(input: {
  entries: BudgetCashEntry[];
  invoices: Invoice[];
  chequeNotes: ChequeNote[];
  today?: string;
}): BudgetCalendarItem[] {
  const today = input.today ?? todayIso();
  const items: BudgetCalendarItem[] = [];

  for (const row of input.entries) {
    if (row.date <= today) continue;
    const date = row.dueDate && row.dueDate > today ? row.dueDate : row.date;
    items.push({
      id: `kasa-${row.id}`,
      date,
      direction: row.direction,
      source: "kasa",
      party: row.party,
      amount: row.amount,
      title: row.category || budgetDirectionLabel(row.direction),
      note: row.description || (row.invoiceNo ? `Fatura ${row.invoiceNo}` : "Planlanan kasa hareketi"),
      documented: isBudgetDocumented(row),
    });
  }

  for (const row of input.invoices) {
    if (isVoidInvoice(row) || !row.dueDate) continue;
    const direction = invoiceDirection(row);
    if (!direction) continue;
    const open = invoiceRemaining(row);
    if (open <= 0.009) continue;
    items.push({
      id: `inv-${row.id}`,
      date: row.dueDate,
      direction,
      source: "fatura",
      party: row.party,
      amount: open,
      title: row.invoiceNo,
      note: direction === "gider" ? "Açık alış bakiyesi" : "Açık satış bakiyesi",
      documented: true,
    });
  }

  for (const row of flattenChequeInstallments(input.chequeNotes)) {
    if (row.status !== "Bekliyor" || !row.dueDate) continue;
    items.push({
      id: `cek-${row.id}`,
      date: row.dueDate,
      direction: row.direction === "given" ? "gider" : "gelir",
      source: "cek",
      party: row.party,
      amount: row.amount,
      title: row.docNo,
      note: row.serialNo ? `Seri ${row.serialNo}` : "Vadesi bekleyen çek / senet",
      documented: Boolean(row.invoiceNo.trim()),
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.party.localeCompare(b.party, "tr"));
}

export function splitCalendar(items: BudgetCalendarItem[], today = todayIso()) {
  const gelir = items.filter((row) => row.direction === "gelir");
  const gider = items.filter((row) => row.direction === "gider");
  const group = (rows: BudgetCalendarItem[]) => ({
    overdue: rows.filter((row) => calendarBucket(row.date, today) === "overdue"),
    approaching: rows.filter((row) => calendarBucket(row.date, today) === "approaching"),
    upcoming: rows.filter((row) => calendarBucket(row.date, today) === "upcoming"),
  });
  return { gelir: group(gelir), gider: group(gider) };
}
