import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Radix Select: SelectItem value cannot be an empty string. Dedupes trimmed values. */
export function selectItemValues(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("tr-TR");
}

/** Her kelimenin (ve tireli parçanın) ilk harfini tr-TR büyük harfe çevirir. */
export function capitalizeWordsTr(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          if (!part) return part;
          return part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1);
        })
        .join("-")
    )
    .join(" ");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Uygulama takvim kuşağı.
 * YYYY-MM-DD alanları (sipariş, SKT, fatura) bu günün takvimidir; UTC'ye çevrilmez.
 * timestamptz anları (denetim, aktarım) UTC saklanır, gösterimde bu kuşağa çevrilir.
 * Ekranda tarihler Türkiye biçiminde: dd-mm-yyyy.
 */
export const APP_TIME_ZONE = "Europe/Istanbul";

/** Europe/Istanbul takvim günü YYYY-MM-DD */
export function toLocalIsoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayIso(): string {
  return toLocalIsoDate();
}

export function plusDaysIso(days: number): string {
  const [y, m, d] = todayIso().split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function plusYearsIso(years: number): string {
  const [y, m, d] = todayIso().split("-").map(Number);
  const next = new Date(Date.UTC(y + years, m - 1, d));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function parseLocalDate(iso: string): Date {
  const dateOnly = iso.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateOnly)) {
    const [d, m, y] = dateOnly.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

/** Ekranda Türkiye biçimi: dd-mm-yyyy */
export function formatDate(date: string): string {
  if (!date?.trim()) return "—";
  if (date.includes("T")) {
    const instant = new Date(date);
    if (Number.isNaN(instant.getTime())) return "—";
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
    const [y, m, d] = ymd.split("-");
    return `${d}-${m}-${y}`;
  }
  const dateOnly = date.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split("-");
    return `${d}-${m}-${y}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateOnly)) {
    return dateOnly;
  }
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()}`;
}

export function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Kayıt yazılamadı (tarayıcı depolama dolu olabilir)");
  }
}

/** localStorage’dan dizi okur; bozuk / dizi olmayan kayıtları yok sayar */
export function readFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
