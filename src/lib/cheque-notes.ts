import type {
  ChequeDirection,
  ChequeInstallmentStatus,
  ChequeInstrumentStatus,
  ChequeKind,
  ChequeNote,
  ChequeNoteInstallment,
} from "@/data/catalog";
import { nextDocumentNo } from "@/lib/invoice-docs";
import { plusMonthsIso } from "@/lib/utils";

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

export function rollupChequeStatus(
  installments: { status: string }[]
): ChequeInstrumentStatus {
  if (installments.length === 0) return "Portföy";
  if (installments.every((row) => row.status === "Karşılıksız")) return "Karşılıksız";
  const used = installments.filter((row) => row.status === "Faturada").length;
  if (used === 0) return "Portföy";
  if (used >= installments.length) return "Kapandı";
  return "Kısmi";
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
