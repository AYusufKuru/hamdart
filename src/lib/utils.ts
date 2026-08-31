import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number): string {
  return value.toLocaleString("tr-TR");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Yerel takvim günü (UTC kayması yok) */
export function toLocalIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayIso(): string {
  return toLocalIsoDate();
}

export function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

export function plusYearsIso(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return toLocalIsoDate(d);
}

export function parseLocalDate(iso: string): Date {
  const dateOnly = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

export function formatDate(date: string): string {
  if (!date?.trim()) return "—";
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
