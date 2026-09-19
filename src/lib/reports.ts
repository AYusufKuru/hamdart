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
  documentTypeFromKind,
  isConfirmedWorkflow,
  normalizeInvoiceStatus,
  type InvoiceDocumentType,
} from "@/lib/invoice-docs";
import { formatDate, formatNumber, todayIso } from "@/lib/utils";
import {
  chequeDirectionLabel,
  chequeKindLabel,
  flattenChequeInstallments,
} from "@/lib/cheque-notes";
import { budgetDocumentLabel, isBudgetDocumented, isUndocumentedCash } from "@/lib/budget-cash";

export type ReportId =
  | "top-sales-customers"
  | "customers"
  | "suppliers"
  | "inactive-customers"
  | "inactive-suppliers"
  | "customers-without-sales"
  | "top-sales-accounts"
  | "payables"
  | "payables-due"
  | "paid-purchases"
  | "receivables"
  | "overdue-receivables"
  | "upcoming-receivables"
  | "nonpaying-customers"
  | "collections-cash-bank"
  | "collections-party"
  | "payments-expense"
  | "cheque-notes"
  | "cheque-notes-due"
  | "budget-income"
  | "budget-expense"
  | "budget-undocumented-payments"
  | "budget-undocumented-income"
  | "sales"
  | "sales-returns"
  | "sales-orders"
  | "quotes"
  | "delivery-notes"
  | "cancelled-sales"
  | "withholding-sales"
  | "document-product-search";

export type ReportGroup = {
  title: string;
  items: { id: ReportId; label: string }[];
};

export const REPORT_GROUPS: ReportGroup[] = [
  {
    title: "Kâr Zarar",
    items: [{ id: "top-sales-customers", label: "En Çok Satış Yapılan Müşteri Listesi" }],
  },
  {
    title: "Müşteri / Tedarikçi",
    items: [
      { id: "customers", label: "Müşteri Listesi" },
      { id: "suppliers", label: "Tedarikçi Listesi" },
      { id: "inactive-customers", label: "Pasif Müşteri Listesi" },
      { id: "inactive-suppliers", label: "Pasif Tedarikçi Listesi" },
      { id: "customers-without-sales", label: "Satış Yapılmayan Hesap Listesi" },
      { id: "top-sales-accounts", label: "En Çok Satış Yapılan Hesaplar" },
    ],
  },
  {
    title: "Borçlar",
    items: [
      { id: "payables", label: "Tüm Alacaklı Hesaplar" },
      { id: "payables-due", label: "Vadeli Borçlar" },
      { id: "paid-purchases", label: "Ödemesi Yapılanlar" },
    ],
  },
  {
    title: "Alacaklar",
    items: [
      { id: "receivables", label: "Bize Borçlu Hesaplar" },
      { id: "overdue-receivables", label: "Tahsilat Geciktirenler" },
      { id: "upcoming-receivables", label: "Gelecek Tahsilatlar" },
      { id: "nonpaying-customers", label: "Ödeme Yapmayan Müşteriler" },
    ],
  },
  {
    title: "Para Analizi",
    items: [
      { id: "collections-cash-bank", label: "Tahsilatlar - Kasa/Banka" },
      { id: "collections-party", label: "Tahsilatlar - Cari" },
      { id: "payments-expense", label: "Ödemeler - Giderler" },
      { id: "cheque-notes", label: "Çek / Senet Listesi" },
      { id: "cheque-notes-due", label: "Vadesi Gelen Çek / Senet" },
    ],
  },
  {
    title: "Kasa / Bütçe",
    items: [
      { id: "budget-income", label: "Kasa Gelirleri" },
      { id: "budget-expense", label: "Kasa Giderleri" },
      { id: "budget-undocumented-payments", label: "Belgesiz Ödemeler" },
      { id: "budget-undocumented-income", label: "Belgesiz Tahsilatlar" },
    ],
  },
  {
    title: "Evrak Analizi",
    items: [
      { id: "sales", label: "Satışlar" },
      { id: "sales-returns", label: "Satış İade" },
      { id: "sales-orders", label: "Satış Siparişleri" },
      { id: "quotes", label: "Fiyat Teklifleri" },
      { id: "delivery-notes", label: "Sevk İrsaliyeleri" },
      { id: "cancelled-sales", label: "İptal Satışlar" },
      { id: "withholding-sales", label: "Tevkifatlı Satışlar" },
      { id: "document-product-search", label: "Evraktan ürün sorgula" },
    ],
  },
];

export type ReportColumn = { key: string; header: string; className?: string };
export type ReportTableRow = { id: string; href?: string } & Record<string, string | number>;

function samePartyName(a: string, b: string) {
  return a.trim().toLocaleLowerCase("tr") === b.trim().toLocaleLowerCase("tr");
}

function invoiceHref(id: string) {
  return `/invoices/${encodeURIComponent(id)}`;
}

function orderHref(id: string) {
  return `/orders/${encodeURIComponent(id)}`;
}

function invoiceHrefByNo(data: ReportsData, invoiceNo?: string) {
  const no = invoiceNo?.trim();
  if (!no || no === "—") return "";
  const hit = data.invoices.find((row) => row.invoiceNo === no);
  return hit ? invoiceHref(hit.id) : "";
}

export function partyHref(data: ReportsData, name?: string) {
  const n = name?.trim();
  if (!n || n === "—") return "";
  const customer = data.customers.find(
    (row) => samePartyName(row.name, n) || samePartyName(row.invoiceName, n)
  );
  if (customer) return `/customers/${encodeURIComponent(customer.id)}`;
  const supplier = data.suppliers.find(
    (row) => samePartyName(row.name, n) || samePartyName(row.invoiceName, n)
  );
  if (supplier) return `/suppliers/${encodeURIComponent(supplier.id)}`;
  return "";
}

function firstHref(...hrefs: (string | undefined)[]) {
  return hrefs.find((href) => href && href.length > 0) || "";
}

export type ReportsData = {
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  events: InvoiceEvent[];
  customers: Customer[];
  suppliers: Supplier[];
  deliveryNotes: DeliveryNote[];
  deliveryLines: DeliveryNoteLine[];
  ledger: LedgerEntry[];
  orders: Order[];
  chequeNotes: ChequeNote[];
  budgetCashEntries: BudgetCashEntry[];
};

function docType(row: Invoice): InvoiceDocumentType {
  return documentTypeFromKind(row.kind, row.documentType);
}

function remaining(row: Invoice) {
  return Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0));
}

function isVoid(row: Invoice) {
  const status = normalizeInvoiceStatus(row.status);
  return status === "İptal Edildi" || status === "Reddedildi";
}

export function isSalesInvoice(row: Invoice) {
  const type = docType(row);
  return type === "sales" || type === "cash_sale";
}

export function isPurchaseInvoice(row: Invoice) {
  return docType(row) === "purchase";
}

function isQuote(row: Invoice) {
  return docType(row) === "quote";
}

function isReturn(row: Invoice) {
  return docType(row) === "return";
}

function money(value: number) {
  return formatNumber(value);
}

function invoiceByNo(data: ReportsData) {
  return new Map(data.invoices.map((row) => [row.invoiceNo, row]));
}

function salesByParty(invoices: Invoice[], data: ReportsData) {
  const map = new Map<string, { amount: number; count: number }>();
  for (const row of invoices) {
    if (!isSalesInvoice(row) || isVoid(row)) continue;
    const prev = map.get(row.party) ?? { amount: 0, count: 0 };
    prev.amount += Number(row.amount || 0);
    prev.count += 1;
    map.set(row.party, prev);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([party, v], i) => ({
      id: party || String(i),
      party,
      count: v.count,
      amount: money(v.amount),
      href: partyHref(data, party),
    }));
}

function partyBalance(invoices: Invoice[], kind: "sales" | "purchase", data: ReportsData) {
  const map = new Map<string, { amount: number; paid: number; open: number; count: number }>();
  for (const row of invoices) {
    if (isVoid(row)) continue;
    if (kind === "sales" && !isSalesInvoice(row)) continue;
    if (kind === "purchase" && !isPurchaseInvoice(row)) continue;
    const open = remaining(row);
    const prev = map.get(row.party) ?? { amount: 0, paid: 0, open: 0, count: 0 };
    prev.amount += Number(row.amount || 0);
    prev.paid += Number(row.paidAmount || 0);
    prev.open += open;
    prev.count += 1;
    map.set(row.party, prev);
  }
  return [...map.entries()]
    .filter(([, v]) => v.open > 0.009)
    .sort((a, b) => b[1].open - a[1].open)
    .map(([party, v], i) => ({
      id: party || String(i),
      party,
      count: v.count,
      amount: money(v.amount),
      paid: money(v.paid),
      open: money(v.open),
      href: partyHref(data, party),
    }));
}

function invoiceRows(rows: Invoice[]) {
  return rows.map((row) => ({
    id: row.id,
    invoiceNo: row.invoiceNo,
    party: row.party,
    date: formatDate(row.issueDate),
    due: formatDate(row.dueDate),
    amount: money(row.amount),
    paid: money(row.paidAmount || 0),
    open: money(remaining(row)),
    status: normalizeInvoiceStatus(row.status),
    href: invoiceHref(row.id),
  }));
}

const INVOICE_COLUMNS: ReportColumn[] = [
  { key: "invoiceNo", header: "Belge no", className: "font-mono text-sm" },
  { key: "party", header: "Cari" },
  { key: "date", header: "Tarih" },
  { key: "due", header: "Vade" },
  { key: "amount", header: "Tutar", className: "text-right" },
  { key: "paid", header: "Ödenen", className: "text-right" },
  { key: "open", header: "Kalan", className: "text-right" },
  { key: "status", header: "Durum" },
];

export function reportLabel(id: ReportId) {
  for (const group of REPORT_GROUPS) {
    const hit = group.items.find((item) => item.id === id);
    if (hit) return hit.label;
  }
  return id;
}

export function buildReport(
  id: ReportId,
  data: ReportsData,
  productQuery = ""
): { columns: ReportColumn[]; rows: ReportTableRow[]; empty: string } {
  const today = todayIso();
  const invoices = data.invoices;

  if (id === "top-sales-customers" || id === "top-sales-accounts") {
    return {
      columns: [
        { key: "party", header: "Cari" },
        { key: "count", header: "Fatura", className: "text-right" },
        { key: "amount", header: "Satış tutarı", className: "text-right font-bold" },
      ],
      rows: salesByParty(invoices, data),
      empty: "Satış faturası yok",
    };
  }

  if (id === "customers" || id === "inactive-customers") {
    const active = id === "customers";
    return {
      columns: [
        { key: "name", header: "Unvan" },
        { key: "contact", header: "Yetkili" },
        { key: "taxNo", header: "VKN / TCKN" },
        { key: "email", header: "E-posta" },
      ],
      rows: data.customers
        .filter((c) => Boolean(c.active) === active)
        .map((c) => ({
          id: c.id,
          name: c.name,
          contact: c.contact || "—",
          taxNo: c.taxNo || "—",
          email: c.email || "—",
          href: `/customers/${encodeURIComponent(c.id)}`,
        })),
      empty: active ? "Müşteri yok" : "Pasif müşteri yok",
    };
  }

  if (id === "suppliers" || id === "inactive-suppliers") {
    const active = id === "suppliers";
    return {
      columns: [
        { key: "name", header: "Unvan" },
        { key: "contact", header: "Yetkili" },
        { key: "taxNo", header: "VKN / TCKN" },
        { key: "city", header: "İl" },
      ],
      rows: data.suppliers
        .filter((s) => Boolean(s.active) === active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          contact: s.contact || s.mobile || "—",
          taxNo: s.taxNo || "—",
          city: s.city || "—",
          href: `/suppliers/${encodeURIComponent(s.id)}`,
        })),
      empty: active ? "Tedarikçi yok" : "Pasif tedarikçi yok",
    };
  }

  if (id === "customers-without-sales") {
    const sold = new Set(
      invoices.filter((row) => isSalesInvoice(row) && !isVoid(row)).map((row) => row.party)
    );
    return {
      columns: [
        { key: "name", header: "Unvan" },
        { key: "contact", header: "Yetkili" },
        { key: "taxNo", header: "VKN / TCKN" },
      ],
      rows: data.customers
        .filter((c) => c.active && !sold.has(c.name))
        .map((c) => ({
          id: c.id,
          name: c.name,
          contact: c.contact || "—",
          taxNo: c.taxNo || "—",
          href: `/customers/${encodeURIComponent(c.id)}`,
        })),
      empty: "Satış yapılmayan aktif müşteri yok",
    };
  }

  if (id === "payables") {
    return {
      columns: [
        { key: "party", header: "Tedarikçi" },
        { key: "count", header: "Fatura", className: "text-right" },
        { key: "amount", header: "Toplam", className: "text-right" },
        { key: "paid", header: "Ödenen", className: "text-right" },
        { key: "open", header: "Borç", className: "text-right font-bold" },
      ],
      rows: partyBalance(invoices, "purchase", data),
      empty: "Açık alış borcu yok",
    };
  }

  if (id === "payables-due") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(
        invoices.filter(
          (row) =>
            isPurchaseInvoice(row) &&
            !isVoid(row) &&
            remaining(row) > 0.009 &&
            row.dueDate >= today
        )
      ),
      empty: "Vadeli açık alış faturası yok",
    };
  }

  if (id === "paid-purchases") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(
        invoices.filter(
          (row) =>
            isPurchaseInvoice(row) &&
            !isVoid(row) &&
            (normalizeInvoiceStatus(row.status) === "Ödendi" || remaining(row) <= 0.009)
        )
      ),
      empty: "Ödenmiş alış faturası yok",
    };
  }

  if (id === "receivables") {
    return {
      columns: [
        { key: "party", header: "Müşteri" },
        { key: "count", header: "Fatura", className: "text-right" },
        { key: "amount", header: "Toplam", className: "text-right" },
        { key: "paid", header: "Tahsil", className: "text-right" },
        { key: "open", header: "Alacak", className: "text-right font-bold" },
      ],
      rows: partyBalance(invoices, "sales", data),
      empty: "Açık satış alacağı yok",
    };
  }

  if (id === "overdue-receivables") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(
        invoices.filter(
          (row) =>
            isSalesInvoice(row) &&
            !isVoid(row) &&
            remaining(row) > 0.009 &&
            row.dueDate &&
            row.dueDate < today
        )
      ),
      empty: "Vadesi geçen alacak yok",
    };
  }

  if (id === "upcoming-receivables") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(
        invoices.filter(
          (row) =>
            isSalesInvoice(row) &&
            !isVoid(row) &&
            remaining(row) > 0.009 &&
            row.dueDate >= today
        )
      ),
      empty: "Gelecek tahsilat yok",
    };
  }

  if (id === "nonpaying-customers") {
    const map = new Map<string, { amount: number; paid: number }>();
    for (const row of invoices) {
      if (!isSalesInvoice(row) || isVoid(row)) continue;
      const prev = map.get(row.party) ?? { amount: 0, paid: 0 };
      prev.amount += Number(row.amount || 0);
      prev.paid += Number(row.paidAmount || 0);
      map.set(row.party, prev);
    }
    return {
      columns: [
        { key: "party", header: "Müşteri" },
        { key: "amount", header: "Satış", className: "text-right" },
        { key: "paid", header: "Tahsil", className: "text-right" },
      ],
      rows: [...map.entries()]
        .filter(([, v]) => v.amount > 0.009 && v.paid <= 0.009)
        .map(([party, v], i) => ({
          id: party || String(i),
          party,
          amount: money(v.amount),
          paid: money(v.paid),
          href: partyHref(data, party),
        })),
      empty: "Hiç ödeme yapmamış müşteri yok",
    };
  }

  if (id === "collections-cash-bank") {
    const byInvoice = invoiceByNo(data);
    const map = new Map<string, number>();
    for (const event of data.events) {
      if (event.kind !== "payment") continue;
      const inv = byInvoice.get(event.invoiceNo);
      if (!inv || !isSalesInvoice(inv)) continue;
      const method = event.method.trim() || "Belirtilmedi";
      map.set(method, (map.get(method) ?? 0) + Number(event.amount || 0));
    }
    for (const entry of data.budgetCashEntries ?? []) {
      if (entry.direction !== "gelir") continue;
      map.set("Kasa", (map.get("Kasa") ?? 0) + Number(entry.amount || 0));
    }
    return {
      columns: [
        { key: "method", header: "Kanal" },
        { key: "amount", header: "Tahsilat", className: "text-right font-bold" },
      ],
      rows: [...map.entries()].map(([method, amount]) => ({
        id: method,
        method,
        amount: money(amount),
        href: "/budget",
      })),
      empty: "Tahsilat hareketi yok",
    };
  }

  if (id === "collections-party") {
    const byInvoice = invoiceByNo(data);
    const map = new Map<string, number>();
    for (const event of data.events) {
      if (event.kind !== "payment") continue;
      const inv = byInvoice.get(event.invoiceNo);
      if (!inv || !isSalesInvoice(inv)) continue;
      map.set(inv.party, (map.get(inv.party) ?? 0) + Number(event.amount || 0));
    }
    for (const entry of data.budgetCashEntries ?? []) {
      if (entry.direction !== "gelir") continue;
      map.set(entry.party, (map.get(entry.party) ?? 0) + Number(entry.amount || 0));
    }
    return {
      columns: [
        { key: "party", header: "Cari" },
        { key: "amount", header: "Tahsilat", className: "text-right font-bold" },
      ],
      rows: [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([party, amount], i) => ({
          id: party || String(i),
          party,
          amount: money(amount),
          href: firstHref(partyHref(data, party), "/budget"),
        })),
      empty: "Cari tahsilatı yok",
    };
  }

  if (id === "payments-expense") {
    const byInvoice = invoiceByNo(data);
    const rows: ReportTableRow[] = [];
    for (const event of data.events) {
      if (event.kind !== "payment") continue;
      const inv = byInvoice.get(event.invoiceNo);
      if (!inv || !isPurchaseInvoice(inv)) continue;
      rows.push({
        id: event.id,
        date: formatDate(event.createdAt.slice(0, 10)),
        party: inv.party,
        method: event.method || "—",
        amount: money(event.amount),
        note: event.note || "—",
        href: firstHref(invoiceHref(inv.id), partyHref(data, inv.party)),
      });
    }
    for (const entry of data.ledger) {
      if (entry.direction !== "Çıktı") continue;
      rows.push({
        id: entry.id,
        date: formatDate(entry.date),
        party: entry.category || "Yevmiye",
        method: entry.status || "—",
        amount: money(entry.amount),
        note: entry.description || "—",
        href: firstHref(partyHref(data, entry.category), "/budget"),
      });
    }
    for (const entry of data.budgetCashEntries ?? []) {
      if (entry.direction !== "gider") continue;
      rows.push({
        id: entry.id,
        date: formatDate(entry.date),
        party: entry.party,
        method: isBudgetDocumented(entry)
          ? "Kasa"
          : isUndocumentedCash(entry)
            ? "Kasa / belgesiz"
            : "Kasa / planlandı",
        amount: money(entry.amount),
        note: entry.description || entry.category || "—",
        href: firstHref(
          invoiceHrefByNo(data, entry.invoiceNo),
          partyHref(data, entry.party),
          "/budget"
        ),
      });
    }
    return {
      columns: [
        { key: "date", header: "Tarih" },
        { key: "party", header: "Cari / kategori" },
        { key: "method", header: "Kanal" },
        { key: "amount", header: "Tutar", className: "text-right font-bold" },
        { key: "note", header: "Not" },
      ],
      rows,
      empty: "Gider ödemesi yok",
    };
  }

  if (id === "cheque-notes" || id === "cheque-notes-due") {
    const rows = flattenChequeInstallments(data.chequeNotes ?? []).filter((row) =>
      id === "cheque-notes-due" ? row.status === "Bekliyor" && row.dueDate <= today : true
    );
    return {
      columns: [
        { key: "docNo", header: "Plan no", className: "font-mono text-sm" },
        { key: "kind", header: "Tür" },
        { key: "direction", header: "Yön" },
        { key: "party", header: "Cari" },
        { key: "due", header: "Vade" },
        { key: "amount", header: "Tutar", className: "text-right font-bold" },
        { key: "status", header: "Durum" },
        { key: "invoiceNo", header: "Fatura" },
      ],
      rows: rows.map((row) => ({
        id: row.id,
        docNo: row.docNo,
        kind: chequeKindLabel(row.kind),
        direction: chequeDirectionLabel(row.direction),
        party: row.party,
        due: formatDate(row.dueDate),
        amount: money(row.amount),
        status: row.status,
        invoiceNo: row.invoiceNo || "—",
        href: firstHref(
          invoiceHrefByNo(data, row.invoiceNo),
          partyHref(data, row.party),
          "/invoices?filter=cheque"
        ),
      })),
      empty: id === "cheque-notes-due" ? "Vadesi gelen çek / senet yok" : "Çek / senet kaydı yok",
    };
  }

  if (
    id === "budget-income" ||
    id === "budget-expense" ||
    id === "budget-undocumented-payments" ||
    id === "budget-undocumented-income"
  ) {
    const cash = data.budgetCashEntries ?? [];
    const filtered = cash.filter((row) => {
      if (id === "budget-income") return row.direction === "gelir";
      if (id === "budget-expense") return row.direction === "gider";
      if (id === "budget-undocumented-payments") {
        return row.direction === "gider" && isUndocumentedCash(row);
      }
      return row.direction === "gelir" && isUndocumentedCash(row);
    });
    return {
      columns: [
        { key: "date", header: "Tarih" },
        { key: "party", header: "Firma" },
        { key: "category", header: "Çeşit" },
        { key: "amount", header: "Tutar", className: "text-right font-bold" },
        { key: "status", header: "Belge" },
        { key: "invoiceNo", header: "Fatura" },
        { key: "note", header: "Açıklama" },
      ],
      rows: filtered.map((row) => ({
        id: row.id,
        date: formatDate(row.date),
        party: row.party,
        category: row.category,
        amount: money(row.amount),
        status: budgetDocumentLabel(row),
        invoiceNo: row.invoiceNo || "—",
        note: row.description || "—",
        href: firstHref(
          invoiceHrefByNo(data, row.invoiceNo),
          partyHref(data, row.party),
          "/budget"
        ),
      })),
      empty:
        id === "budget-undocumented-payments"
          ? "Belgesiz ödeme yok"
          : id === "budget-undocumented-income"
            ? "Belgesiz tahsilat yok"
            : id === "budget-expense"
              ? "Kasa gideri yok"
              : "Kasa geliri yok",
    };
  }

  if (id === "sales") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(invoices.filter((row) => isSalesInvoice(row))),
      empty: "Satış faturası yok",
    };
  }

  if (id === "sales-returns") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(invoices.filter((row) => isReturn(row))),
      empty: "İade faturası yok",
    };
  }

  if (id === "sales-orders") {
    return {
      columns: [
        { key: "orderNo", header: "Sipariş no", className: "font-mono text-sm" },
        { key: "customer", header: "Müşteri" },
        { key: "product", header: "Ürün" },
        { key: "quantity", header: "Miktar", className: "text-right" },
        { key: "date", header: "Tarih" },
        { key: "status", header: "Durum" },
        { key: "value", header: "Tutar", className: "text-right" },
      ],
      rows: data.orders.map((row) => ({
        id: row.id,
        orderNo: row.orderNo,
        customer: row.customer,
        product: row.product,
        quantity: `${formatNumber(row.quantity)} ${row.unit}`,
        date: formatDate(row.orderDate),
        status: row.status,
        value: money(row.value),
        href: firstHref(orderHref(row.id), partyHref(data, row.customer)),
      })),
      empty: "Satış siparişi yok",
    };
  }

  if (id === "quotes") {
    return {
      columns: [
        { key: "invoiceNo", header: "Teklif no", className: "font-mono text-sm" },
        { key: "party", header: "Müşteri" },
        { key: "date", header: "Tarih" },
        { key: "amount", header: "Tutar", className: "text-right" },
        { key: "status", header: "Durum" },
      ],
      rows: invoices.filter(isQuote).map((row) => ({
        id: row.id,
        invoiceNo: row.invoiceNo,
        party: row.party,
        date: formatDate(row.issueDate),
        amount: money(row.amount),
        status: row.status,
        href: firstHref(invoiceHref(row.id), partyHref(data, row.party)),
      })),
      empty: "Fiyat teklifi yok",
    };
  }

  if (id === "delivery-notes") {
    return {
      columns: [
        { key: "noteNo", header: "İrsaliye no", className: "font-mono text-sm" },
        { key: "party", header: "Alıcı" },
        { key: "kind", header: "Tür" },
        { key: "date", header: "Sevk" },
        { key: "warehouse", header: "Depo" },
        { key: "status", header: "Durum" },
      ],
      rows: data.deliveryNotes.map((row) => ({
        id: row.id,
        noteNo: row.noteNo,
        party: row.party,
        kind: row.kind,
        date: formatDate(row.shipDate),
        warehouse: row.warehouse,
        status: row.status,
        href: firstHref(
          invoiceHrefByNo(data, row.relatedInvoiceNo),
          partyHref(data, row.party),
          "/delivery-notes"
        ),
      })),
      empty: "İrsaliye yok",
    };
  }

  if (id === "cancelled-sales") {
    return {
      columns: INVOICE_COLUMNS,
      rows: invoiceRows(invoices.filter((row) => isSalesInvoice(row) && isVoid(row))),
      empty: "İptal satış yok",
    };
  }

  if (id === "withholding-sales") {
    return {
      columns: [
        { key: "invoiceNo", header: "Fatura no", className: "font-mono text-sm" },
        { key: "party", header: "Cari" },
        { key: "date", header: "Tarih" },
        { key: "amount", header: "Tutar", className: "text-right" },
        { key: "withholding", header: "Tevkifat", className: "text-right font-bold" },
      ],
      rows: invoices
        .filter((row) => isSalesInvoice(row) && Number(row.withholding || 0) > 0.009)
        .map((row) => ({
          id: row.id,
          invoiceNo: row.invoiceNo,
          party: row.party,
          date: formatDate(row.issueDate),
          amount: money(row.amount),
          withholding: money(row.withholding),
          href: invoiceHref(row.id),
        })),
      empty: "Tevkifatlı satış yok",
    };
  }

  const needle = productQuery.trim().toLocaleLowerCase("tr");
  const productRows: ReportTableRow[] = [];
  if (needle) {
    const invoiceMap = invoiceByNo(data);
    for (const line of data.invoiceLines) {
      if (!line.description.toLocaleLowerCase("tr").includes(needle)) continue;
      const inv = invoiceMap.get(line.invoiceNo);
      productRows.push({
        id: line.id,
        source: "Fatura",
        docNo: line.invoiceNo,
        party: inv?.party || "—",
        date: inv ? formatDate(inv.issueDate) : "—",
        description: line.description,
        qty: line.quantityLabel || `${line.quantity} ${line.unit}`,
        href: firstHref(inv ? invoiceHref(inv.id) : "", partyHref(data, inv?.party)),
      });
    }
    const noteMap = new Map(data.deliveryNotes.map((row) => [row.noteNo, row]));
    for (const line of data.deliveryLines) {
      if (!line.description.toLocaleLowerCase("tr").includes(needle)) continue;
      const note = noteMap.get(line.noteNo);
      productRows.push({
        id: line.id,
        source: "İrsaliye",
        docNo: line.noteNo,
        party: note?.party || "—",
        date: note ? formatDate(note.shipDate) : "—",
        description: line.description,
        qty: line.quantityLabel,
        href: firstHref(
          invoiceHrefByNo(data, note?.relatedInvoiceNo),
          partyHref(data, note?.party),
          "/delivery-notes"
        ),
      });
    }
  }

  return {
    columns: [
      { key: "source", header: "Evrak" },
      { key: "docNo", header: "Belge no", className: "font-mono text-sm" },
      { key: "party", header: "Cari" },
      { key: "date", header: "Tarih" },
      { key: "description", header: "Ürün / açıklama" },
      { key: "qty", header: "Miktar" },
    ],
    rows: productRows,
    empty: needle ? "Eşleşen kalem yok" : "Ürün adı yazarak evraklarda arayın",
  };
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayIso());
}

export function inMonth(iso: string, key = currentMonthKey()) {
  return monthKey(iso) === key;
}

export function monthChartData(data: ReportsData) {
  const key = currentMonthKey();
  const [year, month] = key.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => {
    const day = `${key}-${String(i + 1).padStart(2, "0")}`;
    return { day: String(i + 1), gelir: 0, gider: 0, tahsilat: 0, odeme: 0 };
  });

  let gelir = 0;
  let gider = 0;
  let tahsilat = 0;
  let odeme = 0;
  const byMethod = new Map<string, number>();
  const byInvoice = invoiceByNo(data);

  for (const row of data.invoices) {
    if (!inMonth(row.issueDate, key) || isVoid(row)) continue;
    const day = Number(row.issueDate.slice(8, 10)) - 1;
    if (day < 0 || day >= daily.length) continue;
    const amount = Number(row.amount || 0);
    if (isSalesInvoice(row) && isConfirmedWorkflow(row.status)) {
      gelir += amount;
      daily[day].gelir += amount;
    }
    if (isPurchaseInvoice(row) && isConfirmedWorkflow(row.status)) {
      gider += amount;
      daily[day].gider += amount;
    }
  }

  for (const entry of data.ledger) {
    if (!inMonth(entry.date, key) || entry.status === "İptal") continue;
    const day = Number(entry.date.slice(8, 10)) - 1;
    if (day < 0 || day >= daily.length) continue;
    const amount = Number(entry.amount || 0);
    if (entry.direction === "Girdi") {
      gelir += amount;
      daily[day].gelir += amount;
    } else if (entry.direction === "Çıktı") {
      gider += amount;
      daily[day].gider += amount;
    }
  }

  for (const entry of data.budgetCashEntries ?? []) {
    if (!inMonth(entry.date, key)) continue;
    const day = Number(entry.date.slice(8, 10)) - 1;
    if (day < 0 || day >= daily.length) continue;
    const amount = Number(entry.amount || 0);
    if (entry.direction === "gelir") {
      gelir += amount;
      tahsilat += amount;
      daily[day].gelir += amount;
      daily[day].tahsilat += amount;
    } else {
      gider += amount;
      odeme += amount;
      daily[day].gider += amount;
      daily[day].odeme += amount;
    }
  }

  for (const event of data.events) {
    if (event.kind !== "payment" || !inMonth(event.createdAt, key)) continue;
    const inv = byInvoice.get(event.invoiceNo);
    const day = Number(event.createdAt.slice(8, 10)) - 1;
    const amount = Number(event.amount || 0);
    if (day >= 0 && day < daily.length) {
      if (inv && isSalesInvoice(inv)) {
        tahsilat += amount;
        daily[day].tahsilat += amount;
        const method = event.method.trim() || "Diğer";
        byMethod.set(method, (byMethod.get(method) ?? 0) + amount);
      }
      if (inv && isPurchaseInvoice(inv)) {
        odeme += amount;
        daily[day].odeme += amount;
      }
    }
  }

  const topCustomers = new Map<string, number>();
  const topSuppliers = new Map<string, number>();
  const statuses = new Map<string, number>();
  let openReceivable = 0;
  let openPayable = 0;
  let overdueReceivable = 0;
  const today = todayIso();

  for (const row of data.invoices) {
    if (isVoid(row)) continue;
    const open = remaining(row);
    if (isSalesInvoice(row)) {
      openReceivable += open;
      if (open > 0.009 && row.dueDate && row.dueDate < today) overdueReceivable += open;
      if (inMonth(row.issueDate, key) && isConfirmedWorkflow(row.status)) {
        topCustomers.set(row.party, (topCustomers.get(row.party) ?? 0) + Number(row.amount || 0));
        const status = normalizeInvoiceStatus(row.status);
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
      }
    }
    if (isPurchaseInvoice(row)) {
      openPayable += open;
      if (inMonth(row.issueDate, key) && isConfirmedWorkflow(row.status)) {
        topSuppliers.set(row.party, (topSuppliers.get(row.party) ?? 0) + Number(row.amount || 0));
      }
    }
  }

  const monthKeys: string[] = [];
  const [yearNow, monthNow] = key.split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const date = new Date(yearNow, monthNow - 1 - i, 1);
    monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  const trend = monthKeys.map((month) => ({
    month: new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(
      new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)
    ),
    gelir: 0,
    gider: 0,
    tahsilat: 0,
  }));
  const trendIndex = new Map(monthKeys.map((month, i) => [month, i]));

  for (const row of data.invoices) {
    if (isVoid(row) || !isConfirmedWorkflow(row.status)) continue;
    const idx = trendIndex.get(monthKey(row.issueDate));
    if (idx === undefined) continue;
    const amount = Number(row.amount || 0);
    if (isSalesInvoice(row)) trend[idx].gelir += amount;
    if (isPurchaseInvoice(row)) trend[idx].gider += amount;
  }
  for (const entry of data.ledger) {
    if (entry.status === "İptal") continue;
    const idx = trendIndex.get(monthKey(entry.date));
    if (idx === undefined) continue;
    if (entry.direction === "Girdi") trend[idx].gelir += Number(entry.amount || 0);
    if (entry.direction === "Çıktı") trend[idx].gider += Number(entry.amount || 0);
  }
  for (const entry of data.budgetCashEntries ?? []) {
    const idx = trendIndex.get(monthKey(entry.date));
    if (idx === undefined) continue;
    if (entry.direction === "gelir") {
      trend[idx].gelir += Number(entry.amount || 0);
      trend[idx].tahsilat += Number(entry.amount || 0);
    }
    if (entry.direction === "gider") trend[idx].gider += Number(entry.amount || 0);
  }
  for (const event of data.events) {
    if (event.kind !== "payment") continue;
    const inv = byInvoice.get(event.invoiceNo);
    if (!inv || !isSalesInvoice(inv)) continue;
    const idx = trendIndex.get(monthKey(event.createdAt));
    if (idx === undefined) continue;
    trend[idx].tahsilat += Number(event.amount || 0);
  }

  const rank = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({
        name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        value,
      }));

  return {
    gelir,
    gider,
    tahsilat,
    odeme,
    net: gelir - gider,
    openReceivable,
    openPayable,
    overdueReceivable,
    daily,
    trend,
    methods: [...byMethod.entries()].map(([name, value]) => ({ name, value })),
    mix: [
      { name: "Gelir", value: gelir },
      { name: "Gider", value: gider },
    ].filter((item) => item.value > 0),
    statuses: [...statuses.entries()].map(([name, value]) => ({ name, value })),
    topCustomers: rank(topCustomers),
    topSuppliers: rank(topSuppliers),
    docs: {
      sales: data.invoices.filter((row) => isSalesInvoice(row) && inMonth(row.issueDate, key)).length,
      purchases: data.invoices.filter((row) => isPurchaseInvoice(row) && inMonth(row.issueDate, key)).length,
      quotes: data.invoices.filter((row) => isQuote(row) && inMonth(row.issueDate, key)).length,
      notes: data.deliveryNotes.filter((row) => inMonth(row.shipDate, key) || inMonth(row.issueDate, key)).length,
      orders: data.orders.filter((row) => inMonth(row.orderDate, key)).length,
    },
  };
}
