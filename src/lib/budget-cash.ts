import type { BudgetCashDirection, BudgetCashEntry, ChequeNote, Invoice } from "@/data/catalog";
import {
  documentTypeFromKind,
  normalizeInvoiceStatus,
} from "@/lib/invoice-docs";
import { flattenChequeInstallments } from "@/lib/cheque-notes";
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
  if (type === "purchase") return "gider";
  return null;
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
