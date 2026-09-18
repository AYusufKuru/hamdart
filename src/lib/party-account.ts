import type {
  BudgetCashEntry,
  ChequeNote,
  DeliveryNote,
  Invoice,
  InvoiceEvent,
} from "@/data/catalog";
import { flattenChequeInstallments } from "@/lib/cheque-notes";
import {
  documentTypeFromKind,
  normalizeInvoiceStatus,
} from "@/lib/invoice-docs";
import { formatNumber, parseLocalDate } from "@/lib/utils";

export type PartyStatementLine = {
  id: string;
  date: string;
  docNo: string;
  kind: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type PartyAccountSummary = {
  balance: number;
  chequeOpen: number;
  noteOpen: number;
  deliveryOpenCount: number;
  avgCollectionDays: number | null;
  lines: PartyStatementLine[];
};

export function partyKey(name: string) {
  return name.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

export function sameParty(a: string, b: string) {
  const key = partyKey(a);
  return Boolean(key) && key === partyKey(b);
}

export function matchesAnyParty(value: string, names: string[]) {
  return names.some((name) => sameParty(value, name));
}

function isSalesInvoice(row: Invoice) {
  const type = documentTypeFromKind(row.kind, row.documentType);
  return type === "sales" || type === "cash_sale";
}

function isPurchaseInvoice(row: Invoice) {
  return documentTypeFromKind(row.kind, row.documentType) === "purchase";
}

function isVoidInvoice(row: Invoice) {
  const status = normalizeInvoiceStatus(row.status);
  return status === "İptal Edildi" || status === "Reddedildi";
}

function isQuoteLike(row: Invoice) {
  const type = documentTypeFromKind(row.kind, row.documentType);
  return type === "quote" || type === "proforma" || type === "preorder" || type === "delivery";
}

function eventDate(row: InvoiceEvent) {
  return row.createdAt?.trim().slice(0, 10) || "";
}

function daysBetween(from: string, to: string) {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export type PartyRole = "customer" | "supplier";

export function moneyTry(value: number) {
  return `${formatNumber(Math.round((Number(value) || 0) * 100) / 100)} ₺`;
}

export function accountTone(balance: number) {
  if (balance > 0.009) return "credit" as const;
  if (balance < -0.009) return "debit" as const;
  return "zero" as const;
}

export function accountStatusWord(balance: number) {
  const tone = accountTone(balance);
  if (tone === "credit") return "Alacak";
  if (tone === "debit") return "Borç";
  return "Sıfır";
}

export function accountStatusLabel(balance: number) {
  const tone = accountTone(balance);
  if (tone === "credit") return `${moneyTry(balance)} alacak`;
  if (tone === "debit") return `${moneyTry(Math.abs(balance))} borç`;
  return "Bakiye sıfır";
}

export function accountToneClass(balance: number) {
  const tone = accountTone(balance);
  if (tone === "credit") return "text-emerald-700";
  if (tone === "debit") return "text-rose-700";
  return "text-muted-foreground";
}

export function emptyPartyAccount(): PartyAccountSummary {
  return {
    balance: 0,
    chequeOpen: 0,
    noteOpen: 0,
    deliveryOpenCount: 0,
    avgCollectionDays: null,
    lines: [],
  };
}

export function buildPartyAccount(
  party: string,
  input: {
    role?: PartyRole;
    invoices?: Invoice[];
    events?: InvoiceEvent[];
    cash?: BudgetCashEntry[];
    cheques?: ChequeNote[];
    deliveries?: DeliveryNote[];
    openingBalance?: number;
    openingBalanceType?: string;
    aliases?: string[];
  }
): PartyAccountSummary {
  const role = input.role ?? "customer";
  const names = [party, ...(input.aliases ?? [])].filter((name) => partyKey(name));
  const isParty = (value: string) => matchesAnyParty(value, names);
  const drafts: Array<Omit<PartyStatementLine, "balance">> = [];
  const opening = Number(input.openingBalance) || 0;
  if (opening > 0.009) {
    const creditor = (input.openingBalanceType ?? "")
      .trim()
      .toLocaleLowerCase("tr")
      .includes("alacak");
    drafts.push({
      id: `opening-${partyKey(party)}`,
      date: "",
      docNo: "Açılış",
      kind: "Açılış",
      description: creditor ? "Devreden alacak" : "Devreden borç",
      debit: creditor ? 0 : opening,
      credit: creditor ? opening : 0,
    });
  }
  const partyInvoices = (input.invoices ?? []).filter(
    (row) => isParty(row.party) && !isVoidInvoice(row) && !isQuoteLike(row)
  );
  const invoiceNos = new Set(partyInvoices.map((row) => row.invoiceNo));
  const eventsByInvoice = new Map<string, InvoiceEvent[]>();
  for (const event of input.events ?? []) {
    if (event.kind !== "payment" || !(event.amount > 0.009)) continue;
    if (!invoiceNos.has(event.invoiceNo)) continue;
    const list = eventsByInvoice.get(event.invoiceNo) ?? [];
    list.push(event);
    eventsByInvoice.set(event.invoiceNo, list);
  }

  const cycleSpans: number[] = [];

  for (const row of partyInvoices) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0.009) continue;
    const isReturn =
      documentTypeFromKind(row.kind, row.documentType) === "return";
    const sale = isSalesInvoice(row) && !isReturn;
    const purchase = isPurchaseInvoice(row) || isReturn;
    if (sale) {
      drafts.push({
        id: `inv-${row.id}`,
        date: row.issueDate,
        docNo: row.invoiceNo,
        kind: "Satış",
        description: row.notes || "Satış faturası",
        debit: amount,
        credit: 0,
      });
    } else if (purchase) {
      drafts.push({
        id: `inv-${row.id}`,
        date: row.issueDate,
        docNo: row.invoiceNo,
        kind: isReturn ? "İade" : "Alış",
        description: row.notes || (isReturn ? "İade faturası" : "Alış faturası"),
        debit: 0,
        credit: amount,
      });
    }

    const payments = eventsByInvoice.get(row.invoiceNo) ?? [];
    if (payments.length > 0) {
      let lastPay = "";
      for (const event of payments) {
        const date = eventDate(event) || row.issueDate;
        if (date > lastPay) lastPay = date;
        drafts.push({
          id: `pay-${event.id}`,
          date,
          docNo: row.invoiceNo,
          kind: sale ? "Tahsilat" : "Ödeme",
          description: event.method || event.note || (sale ? "Fatura tahsilatı" : "Fatura ödemesi"),
          debit: sale ? 0 : Number(event.amount) || 0,
          credit: sale ? Number(event.amount) || 0 : 0,
        });
      }
      const settled = Number(row.paidAmount || 0) + 0.009 >= amount;
      if (settled && ((role === "supplier" && purchase) || (role !== "supplier" && sale))) {
        const span = daysBetween(row.issueDate, lastPay);
        if (span != null && span >= 0) cycleSpans.push(span);
      }
    } else if (Number(row.paidAmount || 0) > 0.009) {
      const paid = Number(row.paidAmount) || 0;
      drafts.push({
        id: `paid-${row.id}`,
        date: row.dueDate || row.issueDate,
        docNo: row.invoiceNo,
        kind: sale ? "Tahsilat" : "Ödeme",
        description: sale ? "Fatura tahsilatı" : "Fatura ödemesi",
        debit: sale ? 0 : paid,
        credit: sale ? paid : 0,
      });
    }
  }

  const linkedInvoices = new Set(
    partyInvoices.map((row) => row.invoiceNo.trim()).filter(Boolean)
  );
  for (const row of input.cash ?? []) {
    if (!isParty(row.party)) continue;
    if (row.invoiceNo.trim() && linkedInvoices.has(row.invoiceNo.trim())) continue;
    const amount = Number(row.amount) || 0;
    if (amount <= 0.009) continue;
    const income = row.direction !== "gider";
    drafts.push({
      id: `cash-${row.id}`,
      date: row.date,
      docNo: row.invoiceNo || "Kasa",
      kind: income ? "Tahsilat" : "Ödeme",
      description: row.description || row.category || (income ? "Gelir" : "Gider"),
      debit: income ? 0 : amount,
      credit: income ? amount : 0,
    });
  }

  for (const row of input.deliveries ?? []) {
    if (!isParty(row.party)) continue;
    drafts.push({
      id: `dn-${row.id}`,
      date: row.shipDate || row.issueDate,
      docNo: row.noteNo,
      kind: "İrsaliye",
      description: row.warehouse || row.status || "Sevk irsaliyesi",
      debit: 0,
      credit: 0,
    });
  }

  drafts.sort(
    (a, b) =>
      (a.date || "0000-01-01").localeCompare(b.date || "0000-01-01") ||
      a.docNo.localeCompare(b.docNo, "tr")
  );
  let running = 0;
  const lines: PartyStatementLine[] = drafts.map((row) => {
    running += row.debit - row.credit;
    return { ...row, balance: running };
  });

  const chequeDirection = role === "supplier" ? "given" : "received";
  let chequeOpen = 0;
  let noteOpen = 0;
  for (const row of flattenChequeInstallments(input.cheques ?? [])) {
    if (!isParty(row.party) || row.direction !== chequeDirection) continue;
    if (row.status !== "Bekliyor") continue;
    if (row.kind === "senet") noteOpen += Number(row.amount) || 0;
    else chequeOpen += Number(row.amount) || 0;
  }

  const deliveryOpenCount = (input.deliveries ?? []).filter(
    (row) => isParty(row.party) && !row.relatedInvoiceNo.trim()
  ).length;

  return {
    balance: running,
    chequeOpen,
    noteOpen,
    deliveryOpenCount,
    avgCollectionDays:
      cycleSpans.length > 0
        ? Math.round(cycleSpans.reduce((sum, n) => sum + n, 0) / cycleSpans.length)
        : null,
    lines: lines.slice().reverse(),
  };
}

export function buildPartyAccountMap(
  names: string[],
  input: Parameters<typeof buildPartyAccount>[1]
) {
  const map = new Map<string, PartyAccountSummary>();
  for (const name of names) {
    map.set(partyKey(name), buildPartyAccount(name, input));
  }
  return map;
}
