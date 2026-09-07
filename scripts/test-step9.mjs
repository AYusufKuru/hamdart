/**
 * Adım 9 — katalog yazma API, bağlı kayıt, personel maskeleme.
 * Kullanım: node scripts/test-step9.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "YeniGuclu1Sifre";
const ADMIN_INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";
const VIEWER_PASSWORD = process.env.DEV_TEST_PASSWORD ?? "GelistirmeTest1";

let jar = new Map();
let pass = 0;
let fail = 0;

const cookieHeader = () =>
  [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function captureCookie(res) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === "") jar.delete(name);
    else jar.set(name, value);
  }
}

async function call(method, path, body) {
  const cookie = cookieHeader();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrf = jar.get("hamdart-csrf");
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: payload,
    redirect: "manual",
  });
  captureCookie(res);
  let parsed = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    parsed = await res.json().catch(() => null);
  }
  return { status: res.status, payload: parsed };
}

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

async function login(username, password, initial) {
  jar = new Map();
  await call("GET", "/login");
  let r = await call("POST", "/api/auth/login", { username, password });
  if (r.status !== 200 && initial) {
    r = await call("POST", "/api/auth/login", { username, password: initial });
    if (r.status === 200 && r.payload?.user?.mustChangePassword) {
      const changed = await call("POST", "/api/auth/change-password", {
        currentPassword: initial,
        newPassword: password,
      });
      if (changed.status !== 200) {
        throw new Error(`sifre degistirilemedi: ${JSON.stringify(changed)}`);
      }
    }
  }
  const me = await call("GET", "/api/auth/me");
  if (me.status !== 200) {
    throw new Error(`${username} girisi basarisiz: ${JSON.stringify(r)}`);
  }
}

console.log(`Test adresi: ${BASE}\n`);

console.log("1) Oturumsuz / yetkisiz");
{
  const res = await fetch(`${BASE}/api/catalog/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "X" }),
    redirect: "manual",
  });
  check(
    "oturumsuz POST customers reddedildi",
    res.status === 401 || res.status === 403,
    res.status
  );
}

await login("dev-izleyici", VIEWER_PASSWORD);
{
  const denied = await call("POST", "/api/catalog/customers", { name: "Izleyici" });
  check("izleyici POST customers -> 403", denied.status === 403, denied);

  const personnel = await call("GET", "/api/catalog/personnel");
  const first = personnel.payload?.[0];
  check("izleyici personel okur", personnel.status === 200, personnel.status);
  check("maas masked null", !first || first.salary === null, first?.salary);
  check("iban masked null", !first || first.iban === null, first?.iban);
}

await login("admin", ADMIN_PASSWORD, ADMIN_INITIAL);

console.log("\n2) Musteri CRUD + bagli kayit");
{
  const stamp = Date.now();
  const free = await call("POST", "/api/catalog/customers", {
    name: `Step9 Serbest ${stamp}`,
    contact: "A",
    email: "a@example.com",
  });
  check("musteri olusturuldu", free.status === 201, free);
  check("active true", free.payload?.active === true, free.payload);

  const missing = await call("POST", "/api/catalog/customers", { contact: "X" });
  check("eksik ad -> 400", missing.status === 400, missing);
  check("fields.name", Boolean(missing.payload?.fields?.name), missing.payload?.fields);

  const patched = await call("PATCH", `/api/catalog/customers/${free.payload.id}`, {
    contact: "Guncel",
  });
  check("musteri guncellendi", patched.status === 200 && patched.payload?.contact === "Guncel", patched);

  const delFree = await call("DELETE", `/api/catalog/customers/${free.payload.id}`);
  check("bagli olmayan silindi", delFree.status === 200 && delFree.payload?.ok === true && !delFree.payload?.deactivated, delFree);

  const linkedName = `Step9 Bagli ${stamp}`;
  const linked = await call("POST", "/api/catalog/customers", { name: linkedName });
  const inv = await call("POST", "/api/catalog/invoices", {
    invoiceNo: `S9-${stamp}`,
    party: linkedName,
    kind: "Satış",
    issueDate: "2026-09-07",
    dueDate: "2026-10-07",
    amount: 12.5,
    status: "Ödenmedi",
    lines: [
      {
        description: "Kalem",
        quantityLabel: "1 adet",
        unitPrice: 12.5,
        lineTotal: 12.5,
      },
    ],
  });
  check("fatura + kalem", inv.status === 201, inv);
  check("fatura tutar number", inv.payload?.amount === 12.5, inv.payload?.amount);

  const delLinked = await call("DELETE", `/api/catalog/customers/${linked.payload.id}`);
  check("bagli musteri pasife", delLinked.status === 200 && delLinked.payload?.deactivated === true, delLinked);
  check("aktif false", delLinked.payload?.customer?.active === false, delLinked.payload);

  const products = await call("POST", "/api/catalog/products", { name: "X" });
  check("urun yazma 404", products.status === 404, products);
}

console.log("\n3) Personel / yevmiye / butce");
{
  const per = await call("POST", "/api/catalog/personnel", {
    firstName: "Step",
    lastName: "Dokuz",
    department: "IT",
    title: "Test",
    hireDate: "2026-01-01",
    salary: 15000,
    iban: "TR000",
  });
  check("personel olusturuldu", per.status === 201, per);
  check("admin maas gorur", per.payload?.salary === 15000, per.payload?.salary);

  const led = await call("POST", "/api/catalog/ledger", {
    date: "2026-09-07",
    documentNo: `YEV-S9-${Date.now()}`,
    description: "Test",
    category: "Test",
    direction: "Girdi",
    amount: 10,
    status: "Bekliyor",
  });
  check("yevmiye olusturuldu", led.status === 201, led);

  const bud = await call("POST", "/api/catalog/budget", {
    department: `Test-${Date.now()}`,
    annual: 1000,
    spent: 10,
  });
  check("butce olusturuldu", bud.status === 201, bud);

  const delBud = await call("DELETE", `/api/catalog/budget/${bud.payload.id}`);
  check("butce silindi", delBud.status === 200, delBud);
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
