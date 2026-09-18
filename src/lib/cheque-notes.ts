import type {
  ChequeDirection,
  ChequeInstallmentStatus,
  ChequeInstrumentStatus,
  ChequeKind,
  ChequeNote,
  ChequeNoteInstallment,
} from "@/data/catalog";
import { nextDocumentNo } from "@/lib/invoice-docs";
import { plusMonthsIso, todayIso } from "@/lib/utils";

export const CHEQUE_KINDS: { value: ChequeKind; label: string }[] = [
  { value: "cek", label: "Çek" },
  { value: "senet", label: "Senet" },
];

export const CHEQUE_DIRECTIONS: { value: ChequeDirection; label: string }[] = [
  { value: "received", label: "Alınan" },
  { value: "given", label: "Verilen" },
];

export function chequeKindLabel(kind: string) {
  return CHEQUE_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

export function chequeKindFromCategory(name: string): ChequeKind | null {
  const key = name.trim().toLocaleLowerCase("tr");
  if (key === "çek" || key === "cek") return "cek";
  if (key === "senet") return "senet";
  return null;
}

export function chequeDirectionLabel(direction: string) {
  return CHEQUE_DIRECTIONS.find((item) => item.value === direction)?.label ?? direction;
}

export function chequePrefix(kind: ChequeKind) {
  return kind === "senet" ? "SNT" : "CEK";
}

export function nextChequeDocNo(existing: string[], kind: ChequeKind) {
  return nextDocumentNo(existing, chequePrefix(kind));
}

export function incrementSerial(start: string, offset: number) {
  const trimmed = start.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return offset === 0 ? trimmed : `${trimmed}-${offset + 1}`;
  const next = Number(match[2]) + offset;
  return `${match[1]}${String(next).padStart(match[2].length, "0")}`;
}

export const CHEQUE_INSTALLMENT_COUNTS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

export function parseChequeMoney(value: string) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function remainingChequeAmount(total: number, amounts: number[]) {
  const spent = amounts.reduce((sum, n) => sum + (Number(n) || 0), 0);
  return Math.round((total - spent) * 100) / 100;
}

export function suggestChequeInstallment(input: {
  total: number;
  previousAmounts: number[];
  remainingCount: number;
  previousDue?: string;
  issueDate?: string;
}) {
  const remaining = remainingChequeAmount(input.total, input.previousAmounts);
  const steps = Math.max(1, input.remainingCount);
  const raw = remaining / steps;
  const amount = Math.max(0, Math.round(raw * 100) / 100);
  const dueDate = input.previousDue
    ? plusMonthsIso(input.previousDue, 1)
    : input.issueDate || todayIso();
  return { amount, dueDate };
}

export function buildChequeInstallments(input: {
  firstDue: string;
  count: number;
  amount: number;
  intervalMonths: number;
  serialStart?: string;
}): Array<{ sequence: number; dueDate: string; amount: number; serialNo: string }> {
  const count = Math.max(1, Math.min(24, Math.floor(input.count) || 1));
  const interval = Math.max(1, Math.floor(input.intervalMonths) || 1);
  const amount = Number(input.amount) || 0;
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      sequence: i + 1,
      dueDate: plusMonthsIso(input.firstDue, i * interval),
      amount,
      serialNo: incrementSerial(input.serialStart ?? "", i),
    });
  }
  return rows;
}

export const CHEQUE_STATUSES = [
  "Bekliyor",
  "Onaylandı",
  "Alındı",
  "Karşılıksız",
  "İptal",
] as const;

export function normalizeChequeStatus(status: string): ChequeInstrumentStatus {
  switch (status) {
    case "Onaylandı":
    case "Kısmi":
      return "Onaylandı";
    case "Alındı":
    case "Kapandı":
      return "Alındı";
    case "Karşılıksız":
      return "Karşılıksız";
    case "İptal":
      return "İptal";
    default:
      return "Bekliyor";
  }
}

export function chequeStatusVariant(status: string) {
  const value = normalizeChequeStatus(status);
  if (value === "Alındı") return "success" as const;
  if (value === "Onaylandı") return "info" as const;
  if (value === "Karşılıksız" || value === "İptal") return "danger" as const;
  return "warning" as const;
}

export function rollupChequeStatus(
  installments: { status: string }[]
): ChequeInstrumentStatus {
  if (installments.length === 0) return "Bekliyor";
  if (installments.every((row) => row.status === "Karşılıksız")) return "Karşılıksız";
  const used = installments.filter((row) => row.status === "Faturada").length;
  if (used === 0) return "Bekliyor";
  if (used >= installments.length) return "Alındı";
  return "Onaylandı";
}

export function paymentMethodForKind(kind: ChequeKind) {
  return kind === "senet" ? "Senet" : "Çek";
}

export function chequeKindFromMethod(method: string): ChequeKind | null {
  if (method === "Çek") return "cek";
  if (method === "Senet") return "senet";
  return null;
}

export function flattenChequeInstallments(notes: ChequeNote[]): Array<
  ChequeNoteInstallment & {
    docNo: string;
    kind: ChequeKind;
    direction: ChequeDirection;
    party: string;
    bankName: string;
    currency: string;
    instrumentStatus: ChequeInstrumentStatus;
  }
> {
  return notes.flatMap((note) =>
    note.installments.map((row) => ({
      ...row,
      docNo: note.docNo,
      kind: note.kind,
      direction: note.direction,
      party: note.party,
      bankName: note.bankName,
      currency: note.currency,
      instrumentStatus: note.status,
    }))
  );
}

export function installmentStatusLabel(status: ChequeInstallmentStatus | string) {
  if (status === "Faturada") return "Faturada";
  if (status === "Karşılıksız") return "Karşılıksız";
  return "Bekliyor";
}
