/** Statik güvenlik başlıkları — next.config ve proxy ortak listesi */

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Accel-Buffering", value: "no" },
];

export const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000; includeSubDomains",
} as const;

export function createCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}
