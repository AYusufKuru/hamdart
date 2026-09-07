/**
 * Adım 4 — kütle atama açıklarının kapanması.
 * Kullanım: node scripts/test-step4.mjs [taban-adres]
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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(mutating || body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(mutating && csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  captureCookie(res);
  let payload = null;
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    payload = await res.json().catch(() => null);
  }
  return { status: res.status, payload };
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

console.log(`Test adresi: ${BASE}\n`);
await loginAsAdmin();

console.log("1) Siparis olusturma — id/orderNo/recipeNo istemciden gelmez");
{
  const r = await call("POST", "/api/orders", {
    id: "hacked-id",
    orderNo: "HACK-9999",
    recipeNo: "REC-HACK",
    customer: "Test Musteri",
    product: "Test Urun",
    quantity: 10,
    unit: "adet",
    status: "delivered",
    orderDate: "2026-09-07",
    deliveryDate: "2026-09-10",
    priority: "normal",
    warehouse: "wh-fabrika",
    value: 100,
  });
  check("olusturma -> 201", r.status === 201, r);
  check("id istemci degeri degil", r.payload?.id !== "hacked-id", r.payload?.id);
  check("orderNo istemci degeri degil", r.payload?.orderNo !== "HACK-9999", r.payload?.orderNo);
  check("orderNo SIP- ile baslar", String(r.payload?.orderNo ?? "").startsWith("SIP-"), r.payload?.orderNo);
  check("recipeNo yok sayildi", !r.payload?.recipeNo, r.payload?.recipeNo);
  check("status enum olarak kabul edildi (delivered)", r.payload?.status === "delivered", r.payload?.status);
}

console.log("\n2) Siparis — gecersiz sayi ve status reddedilir");
{
  const nan = await call("POST", "/api/orders", {
    customer: "X",
    product: "Y",
    quantity: "abc",
    unit: "adet",
    status: "pending",
    orderDate: "2026-09-07",
    deliveryDate: "2026-09-10",
    priority: "normal",
    warehouse: "wh-fabrika",
    value: 1,
  });
  check("NaN miktar -> 400", nan.status === 400, nan);

  const badStatus = await call("POST", "/api/orders", {
    customer: "X",
    product: "Y",
    quantity: 1,
    unit: "adet",
    status: "warehoused",
    orderDate: "2026-09-07",
    deliveryDate: "2026-09-10",
    priority: "normal",
    warehouse: "wh-fabrika",
    value: 1,
  });
  check("uydurma status -> 400", badStatus.status === 400, badStatus);
}

console.log("\n3) Hammadde siparisi — QC atlama engeli");
{
  const before = await call("GET", "/api/raw-material-orders/rmo-9");
  const originalSupplier = before.payload?.supplier;

  const skip = await call("PUT", "/api/raw-material-orders", {
    id: "rmo-9",
    status: "warehoused",
    warehousedAt: "2026-01-01",
    qcCompletedAt: "2026-01-01",
    supplier: "Guncel Tedarikci",
    quantity: 5,
    unitPrice: 10,
  });
  check("to_order duzenleme -> 200", skip.status === 200, skip);
  check("status to_order kaldi", skip.payload?.status === "to_order", skip.payload?.status);
  check("warehousedAt yazilmadi", !skip.payload?.warehousedAt, skip.payload?.warehousedAt);
  check("supplier guncellendi", skip.payload?.supplier === "Guncel Tedarikci", skip.payload?.supplier);
  check("totalPrice sunucuda hesaplandi", skip.payload?.totalPrice === 50, skip.payload?.totalPrice);

  const received = await call("PUT", "/api/raw-material-orders", {
    id: "rmo-2",
    status: "warehoused",
    supplier: "HACK",
  });
  check("received durumunda PUT -> 400", received.status === 400, received);

  await call("PUT", "/api/raw-material-orders", {
    id: "rmo-9",
    supplier: originalSupplier ?? "",
    quantity: 0,
    unitPrice: 0,
  });
}

console.log("\n4) Recete — createdBy/createdAt/id korunur");
{
  const before = await call("GET", "/api/recipes");
  const rec = (before.payload ?? []).find((r) => r.id === "rec-1");
  check("rec-1 mevcut", Boolean(rec), rec?.id);

  const put = await call("PUT", "/api/recipes", {
    id: "rec-1",
    createdBy: "Saldirgan",
    createdAt: "1999-01-01",
    orderId: "hacked-order",
    code: "REC-HACK",
    productName: rec.productName,
    lines: rec.lines,
    extras: rec.extras,
    status: "saved",
  });
  check("PUT -> 200", put.status === 200, put);
  check("createdBy degismedi", put.payload?.createdBy === rec.createdBy, put.payload?.createdBy);
  check("createdAt degismedi", put.payload?.createdAt === rec.createdAt, put.payload?.createdAt);
  check("orderId degismedi", put.payload?.orderId === rec.orderId, put.payload?.orderId);
  check("code degismedi", put.payload?.code === rec.code, put.payload?.code);

  const ghost = await call("PUT", "/api/recipes", {
    id: "rec-yok",
    productName: "Hayalet",
    createdBy: "Saldirgan",
    lines: [{ materialName: "X", unit: "mg", quantityPerUnit: 1 }],
    extras: [],
    status: "saved",
  });
  check("olmayan recete PUT -> 400", ghost.status === 400, ghost);
}

console.log("\n5) Uretim hatti — isim/kod dokunulmaz, verimlilik 0-100");
{
  const lines = await call("GET", "/api/production/lines");
  const line = (lines.payload ?? []).find((l) => l.id === "m050");
  check("m050 mevcut", Boolean(line), line?.id);
  const original = {
    efficiency: line.efficiency,
    product: line.product,
  };

  const high = await call("PATCH", "/api/production/lines", {
    id: "m050",
    patch: { efficiency: 250, name: "HACKED", code: "XXX" },
  });
  check("efficiency 250 -> 400", high.status === 400, high);

  const ok = await call("PATCH", "/api/production/lines", {
    id: "m050",
    patch: { efficiency: 80, name: "HACKED", code: "XXX", product: line.product },
  });
  check("gecerli patch -> 200", ok.status === 200, ok);
  check("isim degismedi", ok.payload?.name === line.name, ok.payload?.name);
  check("kod degismedi", ok.payload?.code === line.code, ok.payload?.code);
  check("efficiency 80", ok.payload?.efficiency === 80, ok.payload?.efficiency);

  await call("PATCH", "/api/production/lines", {
    id: "m050",
    patch: original,
  });
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
