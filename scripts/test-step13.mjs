/**
 * Adım 13 — nginx, HTTPS, IP/çerez, kurulum.
 * Kullanım: node scripts/test-step13.mjs
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let pass = 0;
let fail = 0;

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  GECTI  ${label}`);
  } else {
    fail++;
    console.log(`  BASARISIZ  ${label}`);
    if (detail !== undefined) console.log(`         gelen: ${JSON.stringify(detail)}`);
  }
}

const compose = readFileSync(new URL("../docker-compose.prod.yml", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../deploy/nginx/nginx.conf", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../deploy/nginx/proxy_params.conf", import.meta.url), "utf8");
const httpT = readFileSync(new URL("../deploy/nginx/http.conf.template", import.meta.url), "utf8");
const httpsT = readFileSync(new URL("../deploy/nginx/https.conf.template", import.meta.url), "utf8");
const select = readFileSync(new URL("../deploy/nginx/select-config.sh", import.meta.url), "utf8");
const init = readFileSync(new URL("../deploy/init-certs.sh", import.meta.url), "utf8");
const install = readFileSync(new URL("../deploy/install-ubuntu.sh", import.meta.url), "utf8");
const session = readFileSync(new URL("../src/lib/auth/session.ts", import.meta.url), "utf8");
const csrf = readFileSync(new URL("../src/lib/auth/csrf.ts", import.meta.url), "utf8");
const ip = readFileSync(new URL("../src/lib/server/api-utils.ts", import.meta.url), "utf8");
const cookie = readFileSync(new URL("../src/lib/auth/cookie-secure.ts", import.meta.url), "utf8");

console.log("1) Compose — app kapalı, nginx 80/443");
{
  const appBlock = compose.slice(compose.indexOf("  app:"), compose.indexOf("  nginx:"));
  check("app ports yok", !/^\s+ports:/m.test(appBlock), appBlock.slice(0, 200));
  check("app expose 3000", appBlock.includes("expose:"), "yok");
  check("nginx 80", compose.includes('"80:80"'), "yok");
  check("nginx 443", compose.includes('"443:443"'), "yok");
  check("certbot renew", compose.includes("certbot renew"), "yok");
  check("AUTH_COOKIE_SECURE", compose.includes("AUTH_COOKIE_SECURE"), "yok");
}

console.log("\n2) Nginx sertlik");
check("client_max_body_size 1m", nginx.includes("client_max_body_size 1m"), "yok");
check("yavaş bağlantı timeout", nginx.includes("client_header_timeout 15s"), "yok");
check("login limit_req_zone", nginx.includes("zone=login") && nginx.includes("rate=5r/m"), "yok");
check("login location", httpT.includes("/api/auth/login") && httpsT.includes("/api/auth/login"), "yok");
check("X-Forwarded-For remote_addr", proxy.includes("X-Forwarded-For $remote_addr"), "yok");
check("X-Forwarded-Proto", proxy.includes("X-Forwarded-Proto $scheme"), "yok");
check("X-Real-IP", proxy.includes("X-Real-IP $remote_addr"), "yok");
check("proxy_buffering off", proxy.includes("proxy_buffering off"), "yok");
check("dinamik upstream", proxy.includes("$hamdart_upstream"), "yok");
check("HTTP→HTTPS", httpsT.includes("return 301 https://"), "yok");
check("ACME", httpT.includes(".well-known/acme-challenge") && httpsT.includes(".well-known/acme-challenge"), "yok");
check("HSTS nginx", httpsT.includes("Strict-Transport-Security"), "yok");
check("envsubst yalnızca DOMAIN", select.includes("envsubst '${DOMAIN}'"), "yok");

console.log("\n3) Kurulum ve çerez/IP");
check("install DOMAIN zorunlu", install.includes("CERTBOT_EMAIL") && install.includes("init-certs.sh"), "yok");
check("init-certs certonly", init.includes("certonly") && init.includes("--webroot"), "yok");
check("cookieSecure yardımcısı", cookie.includes("AUTH_COOKIE_SECURE") && session.includes("cookieSecure()"), "yok");
check("csrf aynı secure", csrf.includes("cookieSecure"), "yok");
check("IP önce x-real-ip", ip.indexOf("x-real-ip") < ip.indexOf("x-forwarded-for"), "sıra yanlış");

console.log("\n4) nginx -t (HTTP şablon, Docker varsa)");
{
  const r = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${process.cwd()}/deploy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro`,
      "-v",
      `${process.cwd()}/deploy/nginx/proxy_params.conf:/etc/nginx/proxy_params.conf:ro`,
      "-v",
      `${process.cwd()}/deploy/nginx/http.conf.template:/tmp/http.conf.template:ro`,
      "-e",
      "DOMAIN=erp.example.com",
      "nginx:1.27-alpine",
      "/bin/sh",
      "-c",
      'envsubst \'${DOMAIN}\' < /tmp/http.conf.template > /etc/nginx/conf.d/default.conf && nginx -t',
    ],
    { encoding: "utf8" }
  );
  const ok = r.status === 0;
  check("docker nginx -t", ok, r.stderr || r.stdout || r.status);
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
