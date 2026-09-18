export const SUPPLIER_ACCOUNT_LISTS = ["Tedarikçi", "Müşteri", "Diğer"] as const;
export const SUPPLIER_CURRENCIES = ["TL", "USD", "EUR", "GBP"] as const;
export const SUPPLIER_ACCOUNT_KINDS = [
  "Gerçek kişi / Şahıs Firması",
  "Tüzel kişi",
  "Yabancı",
] as const;
export const SUPPLIER_BALANCE_TYPES = ["Borçlu", "Alacaklı"] as const;
export const SUPPLIER_PRICE_LISTS = [
  "1. Satış Fiyatı",
  "2. Satış Fiyatı",
  "3. Satış Fiyatı",
] as const;

export type SupplierRelative = {
  name: string;
  phone: string;
};

export type SupplierGuarantor = {
  name: string;
  nationalId: string;
  address: string;
  phone: string;
};

export function emptyRelatives(): SupplierRelative[] {
  return Array.from({ length: 4 }, () => ({ name: "", phone: "" }));
}

export function emptyGuarantors(): SupplierGuarantor[] {
  return Array.from({ length: 2 }, () => ({
    name: "",
    nationalId: "",
    address: "",
    phone: "",
  }));
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw?.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseRelatives(raw: string | null | undefined): SupplierRelative[] {
  const parsed = parseJson<SupplierRelative[]>(raw, []);
  const base = emptyRelatives();
  return base.map((slot, i) => ({
    name: parsed[i]?.name?.trim() ?? "",
    phone: parsed[i]?.phone?.trim() ?? "",
  }));
}

export function parseGuarantors(
  raw: string | null | undefined
): SupplierGuarantor[] {
  const parsed = parseJson<SupplierGuarantor[]>(raw, []);
  const base = emptyGuarantors();
  return base.map((slot, i) => ({
    name: parsed[i]?.name?.trim() ?? "",
    nationalId: parsed[i]?.nationalId?.trim() ?? "",
    address: parsed[i]?.address?.trim() ?? "",
    phone: parsed[i]?.phone?.trim() ?? "",
  }));
}

export function serializeRelatives(rows: SupplierRelative[]): string {
  return JSON.stringify(
    rows.slice(0, 4).map((r) => ({
      name: r.name.trim(),
      phone: r.phone.trim(),
    }))
  );
}

export function serializeGuarantors(rows: SupplierGuarantor[]): string {
  return JSON.stringify(
    rows.slice(0, 2).map((r) => ({
      name: r.name.trim(),
      nationalId: r.nationalId.trim(),
      address: r.address.trim(),
      phone: r.phone.trim(),
    }))
  );
}
