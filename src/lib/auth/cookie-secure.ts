/** Üretimde varsayılan true. HTTP-only geçiş için AUTH_COOKIE_SECURE=0 */
export function cookieSecure(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "0" || override === "false") return false;
  if (override === "1" || override === "true") return true;
  return process.env.NODE_ENV === "production";
}
