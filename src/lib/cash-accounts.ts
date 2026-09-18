export const CASH_ACCOUNT_KINDS = ["cash", "bank"] as const;
export type CashAccountKind = (typeof CASH_ACCOUNT_KINDS)[number];

export const CASH_CURRENCIES = ["TRY", "USD", "EUR"] as const;
export type CashCurrency = (typeof CASH_CURRENCIES)[number];

export type CashAccount = {
  id: string;
  kind: CashAccountKind;
  name: string;
  locked: boolean;
  currency: CashCurrency;
  openingBalance: number;
  bankName: string;
  iban: string;
  branch: string;
  accountNo: string;
  notes: string;
  active: boolean;
  createdAt: string;
};

export const SYSTEM_CASH_REGISTERS = [
  { id: "cash-istanbul", name: "İstanbul kasa" },
  { id: "cash-kastamonu", name: "Kastamonu kasa" },
] as const;

export function isCashCurrency(value: string): value is CashCurrency {
  return (CASH_CURRENCIES as readonly string[]).includes(value);
}

export function cashKindLabel(kind: CashAccountKind) {
  return kind === "bank" ? "Banka" : "Kasa";
}

export function cashLocation(row: Pick<CashAccount, "id" | "name">) {
  const hay = `${row.id} ${row.name}`.toLocaleLowerCase("tr");
  if (hay.includes("istanbul")) return "İstanbul";
  if (hay.includes("kastamonu")) return "Kastamonu";
  return row.name;
}

export function formatIban(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

export function currencySymbol(currency: string) {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "₺";
}
