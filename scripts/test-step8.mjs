/**
 * Adım 8 — Decimal, depo API, stok aktarımı, boş ilk render.
 * Kullanım: node scripts/test-step8.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "YeniGuclu1Sifre";
const ADMIN_INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";

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

async function loginAsAdmin() {
  jar = new Map();
  await call("GET", "/login");
  let r = await call("POST", "/api/auth/login", {
    username: "admin",
    password: ADMIN_PASSWORD,
  });
  if (r.status !== 200) {
    r = await call("POST", "/api/auth/login", {
      username: "admin",
      password: ADMIN_INITIAL,
    });
    if (r.status === 200 && r.payload?.user?.mustChangePassword) {
      const changed = await call("POST", "/api/auth/change-password", {
        currentPassword: ADMIN_INITIAL,
        newPassword: ADMIN_PASSWORD,
      });
      if (changed.status !== 200) {
        throw new Error(`sifre degistirilemedi: ${JSON.stringify(changed)}`);
      }
    }
  }
  const me = await call("GET", "/api/auth/me");
  if (me.status !== 200) {
    throw new Error(`admin girisi basarisiz: ${JSON.stringify(r)}`);
  }
}

const FROM = "wh-fabrika";
const TO = "wh-laboratory";
const sku = `TR-STEP8-${Date.now()}`;
const lotNo = `LOT-S8-${Date.now()}`;

console.log(`Test adresi: ${BASE}\n`);

console.log("1) Oturumsuz erisim");
{
  const res = await fetch(`${BASE}/api/stock/transfers`, { redirect: "manual" });
  check("GET /api/stock/transfers -> 401", res.status === 401, res.status);
}

await loginAsAdmin();

console.log("\n2) Depo API — doluluk stoktan");
{
  const [wh, stock] = await Promise.all([
    call("GET", "/api/catalog/warehouses"),
    call("GET", "/api/stock"),
  ]);
  check("GET warehouses -> 200", wh.status === 200, wh);
  check("depo listesi dizi", Array.isArray(wh.payload), wh.payload);
  check("en az 4 depo", (wh.payload?.length ?? 0) >= 4, wh.payload?.length);

  const usedByWh = new Map();
  const countByWh = new Map();
  for (const item of stock.payload ?? []) {
    usedByWh.set(item.warehouseId, (usedByWh.get(item.warehouseId) ?? 0) + item.quantity);
    countByWh.set(item.warehouseId, (countByWh.get(item.warehouseId) ?? 0) + 1);
  }
  const fabrika = (wh.payload ?? []).find((w) => w.id === FROM);
  check("fabrika deposu var", Boolean(fabrika), fabrika);
  check("used sayi", typeof fabrika?.used === "number", fabrika?.used);
  check("items sayi", typeof fabrika?.items === "number", fabrika?.items);
  const expectedUsed = usedByWh.get(FROM) ?? 0;
  const expectedItems = countByWh.get(FROM) ?? 0;
  check(
    "fabrika used stok toplamına eşit",
    Math.abs((fabrika?.used ?? -1) - expectedUsed) < 0.0001,
    { used: fabrika?.used, expectedUsed }
  );
  check(
    "fabrika items stok sayısına eşit",
    fabrika?.items === expectedItems,
    { items: fabrika?.items, expectedItems }
  );
}

console.log("\n3) Decimal — finansal alanlar sayi doner");
{
  const created = await call("POST", "/api/orders", {
    customer: "Step8 Musteri",
    product: "Step8 Urun",
    quantity: 2,
    unit: "adet",
    status: "pending",
    orderDate: "2026-09-07",
    deliveryDate: "2026-09-10",
    priority: "normal",
    warehouse: "Fabrika",
    value: 10.25,
  });
  check("siparis olusturuldu", created.status === 201 || created.status === 200, created);
  check("value number", typeof created.payload?.value === "number", created.payload?.value);
  check("value 10.25", created.payload?.value === 10.25, created.payload?.value);

  const invoices = await call("GET", "/api/catalog/invoices");
  const first = invoices.payload?.[0];
  check("fatura amount number", !first || typeof first.amount === "number", first?.amount);

  const personnel = await call("GET", "/api/catalog/personnel");
  const person = personnel.payload?.[0];
  check("maas number", !person || typeof person.salary === "number", person?.salary);
}

console.log("\n4) Aktarim dogrulama");
{
  const missing = await call("POST", "/api/stock/transfers", { quantity: 1 });
  check("eksik aktarim -> 400", missing.status === 400, missing);
  check("fields.sourceItemId", Boolean(missing.payload?.fields?.sourceItemId), missing.payload?.fields);

  const created = await call("POST", "/api/stock", {
    sku,
    name: "Step8 Aktarim",
    category: "Ham Madde",
    warehouseId: FROM,
    quantity: 10,
    unit: "kg",
    minStock: 1,
    lotNo,
    expiryDate: "2028-01-01",
  });
  check("kaynak stok olusturuldu", created.status === 201 || created.status === 200, created);
  const sourceId = created.payload?.id;

  const same = await call("POST", "/api/stock/transfers", {
    sourceItemId: sourceId,
    toWarehouseId: FROM,
    quantity: 2,
    reason: "manual",
  });
  check("ayni depo -> 400", same.status === 400, same);

  const tooMuch = await call("POST", "/api/stock/transfers", {
    sourceItemId: sourceId,
    toWarehouseId: TO,
    quantity: 99,
    reason: "manual",
  });
  check("fazla miktar -> 400", tooMuch.status === 400, tooMuch);

  const ok = await call("POST", "/api/stock/transfers", {
    sourceItemId: sourceId,
    toWarehouseId: TO,
    quantity: 4,
    reason: "replenishment",
    note: "step8",
  });
  check("aktarim 201", ok.status === 201 || ok.status === 200, ok);
  check("status completed", ok.payload?.status === "completed", ok.payload);
  check("miktar 4", ok.payload?.quantity === 4, ok.payload?.quantity);

  const stock = await call("GET", "/api/stock");
  const source = (stock.payload ?? []).find((i) => i.id === sourceId);
  const dest = (stock.payload ?? []).find(
    (i) => i.warehouseId === TO && i.sku === sku && i.lotNo === lotNo
  );
  check("kaynak 6 kg", source?.quantity === 6, source);
  check("hedef 4 kg", dest?.quantity === 4, dest);

  const list = await call("GET", "/api/stock/transfers");
  check("aktarim listesi dizi", Array.isArray(list.payload), list);
  check(
    "yeni aktarim listede",
    (list.payload ?? []).some((t) => t.id === ok.payload?.id),
    list.payload?.length
  );
}

console.log(`\nSonuc: ${pass} gecti, ${fail} basarisiz`);
process.exit(fail ? 1 : 0);
