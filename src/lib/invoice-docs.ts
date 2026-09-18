export const COMPANY_PROFILE = {
  name: "HamdPharma",
  taxOffice: "",
  taxNo: "",
  address: "Türkiye",
} as const;

export const INVOICE_FORM_TYPES = [
  "sales",
  "purchase",
  "proforma",
  "cash_sale",
  "return",
] as const;

export const INVOICE_PAGE_FILTERS = [
  { value: "purchase", label: "Alış" },
  { value: "sales", label: "Satış" },
  { value: "confirmed", label: "Gerçekleşen" },
  { value: "cheque", label: "Çek / Senet" },
] as const;

export type InvoicePageFilter = (typeof INVOICE_PAGE_FILTERS)[number]["value"];

export const INVOICE_WORKFLOW_STATUSES = [
  { value: "Proforma", label: "Proforma" },
  { value: "Onaylandı", label: "Onaylandı" },
  { value: "Reddedildi", label: "Reddedildi" },
  { value: "İptal Edildi", label: "İptal Edildi" },
  { value: "Ödendi", label: "Ödendi" },
  { value: "Kısmi Ödendi", label: "Kısmi Ödendi" },
  { value: "Ödenmedi", label: "Ödenmedi" },
] as const;

export type InvoiceWorkflowStatus = (typeof INVOICE_WORKFLOW_STATUSES)[number]["value"];

export type InvoiceStatusFilter = "all" | InvoiceWorkflowStatus;

export const INVOICE_STATUS_FILTERS: { value: InvoiceStatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  ...INVOICE_WORKFLOW_STATUSES.filter((s) => s.value !== "Proforma"),
];

export function normalizeInvoiceStatus(status: string): InvoiceWorkflowStatus {
  switch (status) {
    case "Onaylandı":
    case "Kesinleşti":
      return "Onaylandı";
    case "Reddedildi":
      return "Reddedildi";
    case "İptal Edildi":
    case "İptal":
      return "İptal Edildi";
    case "Ödendi":
      return "Ödendi";
    case "Kısmi Ödendi":
    case "Kısmi":
      return "Kısmi Ödendi";
    case "Ödenmedi":
      return "Ödenmedi";
    default:
      return "Proforma";
  }
}

export function isConfirmedWorkflow(status: string) {
  const normalized = normalizeInvoiceStatus(status);
  return (
    normalized === "Onaylandı" ||
    normalized === "Ödenmedi" ||
    normalized === "Kısmi Ödendi" ||
    normalized === "Ödendi"
  );
}

export function paymentStatusFor(amount: number, paidAmount: number): InvoiceWorkflowStatus {
  const total = Number(amount) || 0;
  const paid = Number(paidAmount) || 0;
  if (paid <= 0.009) return "Ödenmedi";
  if (paid + 0.009 >= total && total > 0) return "Ödendi";
  return "Kısmi Ödendi";
}

export function isInvoicePageType(value: string) {
  return (INVOICE_FORM_TYPES as readonly string[]).includes(value);
}

export const INVOICE_DOCUMENT_TYPES = [
  {
    value: "sales",
    label: "Satış",
    bucket: "income",
    confirmedDefault: true,
    prefix: "SAT",
    kind: "Satış",
    partyKind: "customer",
  },
  {
    value: "purchase",
    label: "Alış",
    bucket: "expense",
    confirmedDefault: true,
    prefix: "ALS",
    kind: "Alış",
    partyKind: "supplier",
  },
  {
    value: "return",
    label: "İade",
    bucket: "income",
    confirmedDefault: true,
    prefix: "IAD",
    kind: "İade",
    partyKind: "either",
  },
  {
    value: "quote",
    label: "Fiyat teklifi",
    bucket: "proforma",
    confirmedDefault: false,
    prefix: "TKF",
    kind: "Fiyat teklifi",
    partyKind: "customer",
  },
  {
    value: "delivery",
    label: "Sevk irsaliyesi",
    bucket: "proforma",
    confirmedDefault: false,
    prefix: "IRS",
    kind: "Sevk irsaliyesi",
    partyKind: "customer",
  },
  {
    value: "preorder",
    label: "Ön sipariş",
    bucket: "proforma",
    confirmedDefault: false,
    prefix: "OSP",
    kind: "Ön sipariş",
    partyKind: "customer",
  },
  {
    value: "cash_sale",
    label: "Peşin satış",
    bucket: "income",
    confirmedDefault: true,
    prefix: "PSN",
    kind: "Peşin satış",
    partyKind: "customer",
  },
  {
    value: "proforma",
    label: "Proforma fatura",
    bucket: "proforma",
    confirmedDefault: false,
    prefix: "PRF",
    kind: "Proforma",
    partyKind: "customer",
  },
] as const;

export type InvoiceDocumentType = (typeof INVOICE_DOCUMENT_TYPES)[number]["value"];
export type InvoiceBucket = "income" | "expense" | "proforma";

export const INVOICE_LIST_VIEWS = [
  { value: "all", label: "Tümü" },
  { value: "income", label: "Gelir faturaları" },
  { value: "expense", label: "Gider faturaları" },
  { value: "proforma", label: "Proforma faturaları" },
  { value: "confirmed", label: "Gerçekleşen faturalar" },
] as const;

export type InvoiceListView = (typeof INVOICE_LIST_VIEWS)[number]["value"];

export const E_DOCUMENT_TYPES = ["e-Fatura", "e-Arşiv", "Matbu", "Proforma"] as const;
export const INVOICE_SCENARIOS = ["TEMELFATURA", "TICARIFATURA", "IHRACAT"] as const;
export const VAT_RATES = [0, 1, 10, 20] as const;
export const LINE_UNITS = ["Adet", "Kg", "g", "Lt", "mL", "Kutu", "Paket", "Palet"] as const;
export const PAYMENT_METHODS = [
  "Cari hesap",
  "Nakit",
  "Havale / EFT",
  "Kredi kartı",
  "Çek",
  "Senet",
] as const;
export const INVOICE_STATUSES = [
  "Proforma",
  "Onaylandı",
  "Reddedildi",
  "İptal Edildi",
  "Ödenmedi",
  "Kısmi Ödendi",
  "Ödendi",
] as const;

export function documentTypeMeta(value: string) {
  return (
    INVOICE_DOCUMENT_TYPES.find((t) => t.value === value) ??
    INVOICE_DOCUMENT_TYPES[0]
  );
}

export function documentTypeFromKind(kind: string, stored?: string): InvoiceDocumentType {
  if (stored && INVOICE_DOCUMENT_TYPES.some((t) => t.value === stored)) {
    return stored as InvoiceDocumentType;
  }
  const hit = INVOICE_DOCUMENT_TYPES.find((t) => t.kind === kind);
  return hit?.value ?? "sales";
}

export function bucketFor(
  documentType: string,
  stored?: string
): InvoiceBucket {
  if (stored === "income" || stored === "expense" || stored === "proforma") {
    return stored;
  }
  return documentTypeMeta(documentType).bucket;
}

export function isConfirmedDocument(status: string, documentType: string) {
  const normalized = normalizeInvoiceStatus(status);
  if (normalized === "Proforma" || normalized === "Reddedildi" || normalized === "İptal Edildi") {
    return false;
  }
  return documentTypeMeta(documentType).confirmedDefault || isConfirmedWorkflow(normalized);
}

export function nextDocumentNo(existing: string[], prefix: string, year = new Date().getFullYear()) {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let max = 0;
  for (const no of existing) {
    const m = no.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

export type InvoiceLineCalcInput = {
  quantity: number;
  unitPrice: number;
  discountRate: number;
  vatRate: number;
};

export type InvoiceLineCalc = {
  lineNet: number;
  vatAmount: number;
  lineTotal: number;
  quantityLabel: string;
};

export function calcInvoiceLine(
  input: InvoiceLineCalcInput,
  unit: string
): InvoiceLineCalc {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0;
  const unitPrice = Number.isFinite(input.unitPrice) ? input.unitPrice : 0;
  const discountRate = Number.isFinite(input.discountRate) ? input.discountRate : 0;
  const vatRate = Number.isFinite(input.vatRate) ? input.vatRate : 0;
  const gross = quantity * unitPrice;
  const lineNet = roundMoney(gross * (1 - discountRate / 100));
  const vatAmount = roundMoney(lineNet * (vatRate / 100));
  const lineTotal = roundMoney(lineNet + vatAmount);
  const qtyLabel =
    quantity === 0
      ? `0 ${unit}`
      : `${String(quantity).replace(".", ",")} ${unit}`;
  return { lineNet, vatAmount, lineTotal, quantityLabel: qtyLabel };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function amountToWordsTr(value: number): string {
  const safe = roundMoney(Math.max(0, value));
  const lira = Math.floor(safe);
  const kurus = Math.round((safe - lira) * 100);
  const liraPart = `${tripletToWords(lira)} Türk Lirası`;
  if (kurus === 0) return `${liraPart}`.trim() || "Sıfır Türk Lirası";
  return `${liraPart} ${tripletToWords(kurus)} Kuruş`;
}

function tripletToWords(n: number): string {
  if (n === 0) return "Sıfır";
  const ones = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
  const tens = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
  const scales = ["", "Bin", "Milyon", "Milyar"];
  const parts: string[] = [];
  let remaining = n;
  let scale = 0;
  while (remaining > 0 && scale < scales.length) {
    const chunk = remaining % 1000;
    remaining = Math.floor(remaining / 1000);
    if (chunk) {
      const words = chunkToWords(chunk, ones, tens);
      const scaleWord =
        scale === 1 && chunk === 1 ? "Bin" : `${words}${scales[scale] ? ` ${scales[scale]}` : ""}`.trim();
      parts.unshift(scale === 1 && chunk === 1 ? "Bin" : scaleWord);
    }
    scale += 1;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function chunkToWords(
  chunk: number,
  ones: string[],
  tens: string[]
): string {
  const hundred = Math.floor(chunk / 100);
  const rest = chunk % 100;
  const ten = Math.floor(rest / 10);
  const one = rest % 10;
  const bits: string[] = [];
  if (hundred === 1) bits.push("Yüz");
  else if (hundred > 1) bits.push(`${ones[hundred]} Yüz`);
  if (ten) bits.push(tens[ten]);
  if (one) bits.push(ones[one]);
  return bits.join(" ");
}
