/** Girdi alanlarını güvenli biçimde okur. Route katmanı Zod ile doğrular; bu okuyucular servis katmanında ikinci hattır. */

export class FieldError extends Error {}

/** Bağlı kayıt veya iş kuralı çelişkisi — HTTP 409 */
export class ConflictError extends Error {}

const MAX_TEXT = 200;

export function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new FieldError("İstek gövdesi nesne olmalıdır");
  }
  return body as Record<string, unknown>;
}

export function asString(
  value: unknown,
  field: string,
  opts?: { optional?: boolean; max?: number }
): string | undefined {
  if (value === undefined || value === null) {
    if (opts?.optional) return undefined;
    throw new FieldError(`${field} zorunludur`);
  }
  if (typeof value !== "string") {
    throw new FieldError(`${field} metin olmalıdır`);
  }
  const trimmed = value.trim();
  if (!trimmed && !opts?.optional) {
    throw new FieldError(`${field} zorunludur`);
  }
  const max = opts?.max ?? MAX_TEXT;
  if (trimmed.length > max) {
    throw new FieldError(`${field} en fazla ${max} karakter olabilir`);
  }
  return trimmed;
}

export function asFiniteNumber(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number; optional?: boolean }
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts?.optional) return undefined;
    throw new FieldError(`${field} zorunludur`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new FieldError(`${field} geçerli bir sayı olmalıdır`);
  }
  if (opts?.min !== undefined && n < opts.min) {
    throw new FieldError(`${field} en az ${opts.min} olmalıdır`);
  }
  if (opts?.max !== undefined && n > opts.max) {
    throw new FieldError(`${field} en fazla ${opts.max} olmalıdır`);
  }
  return n;
}

export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  opts?: { optional?: boolean }
): T | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts?.optional) return undefined;
    throw new FieldError(`${field} zorunludur`);
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new FieldError(
      `${field} geçersiz. İzin verilen: ${allowed.join(", ")}`
    );
  }
  return value as T;
}

export function asIsoDate(
  value: unknown,
  field: string,
  opts?: { optional?: boolean }
): string | undefined {
  const s = asString(value, field, { optional: opts?.optional });
  if (!s) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new FieldError(`${field} YYYY-MM-DD biçiminde olmalıdır`);
  }
  return s;
}
