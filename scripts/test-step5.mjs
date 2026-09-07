/**
 * Adım 5 — Zod girdi doğrulama, alan hataları, 1 MB gövde sınırı.
 * Kullanım: node scripts/test-step5.mjs [taban-adres]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "YeniGuclu1Sifre";
const ADMIN_INITIAL = process.env.ADMIN_INITIAL_PASSWORD ?? "YerelGelistirme1";
const MAX_JSON_BODY_BYTES = 1_048_576;

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

async function call(method, path, body, rawBody) {
  const cookie = cookieHeader();
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const csrf = jar.get("hamdart-csrf");
  const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
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

function hasField(payload, name) {
  return Boolean(payload?.fields && typeof payload.fields[name] === "string");
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

const validOrder = {
  customer: "Test Musteri",
  product: "Test Urun",
  quantity: 10,
  unit: "adet",
  status: "pending",
  orderDate: "2026-09-07",
  deliveryDate: "2026-09-10",
  priority: "normal",
  warehouse: "wh-fabrika",
  value: 100,
};

console.log(`Test adresi: ${BASE}\n`);
await loginAsAdmin();

console.log("1) Alan bazli 400 — eksik/gecersiz siparis");
{
  const missing = await call("POST", "/api/orders", { product: "X" });
  check("eksik alanlar -> 400", missing.status === 400, missing);
  check("fields nesnesi doner", Boolean(missing.payload?.fields), missing.payload);
  check("customer alan hatasi", hasField(missing.payload, "customer"), missing.payload?.fields);
  check("error metni dolu", typeof missing.payload?.error === "string", missing.payload);

  const nan = await call("POST", "/api/orders", { ...validOrder, quantity: "abc" });
  check("string miktar -> 400", nan.status === 400, nan);
  check("quantity alan hatasi", hasField(nan.payload, "quantity"), nan.payload?.fields);

  const neg = await call("POST", "/api/orders", { ...validOrder, quantity: -5 });
  check("negatif miktar -> 400", neg.status === 400, neg);
  check("negatif quantity alan hatasi", hasField(neg.payload, "quantity"), neg.payload?.fields);

  const inf = await call("POST", "/api/orders", null, '{"customer":"X","product":"Y","quantity":1e309,"unit":"adet","status":"pending","orderDate":"2026-09-07","deliveryDate":"2026-09-10","priority":"normal","warehouse":"wh-fabrika","value":1}');
  check("Infinity miktar -> 400", inf.status === 400, inf);
  check("Infinity quantity alan hatasi", hasField(inf.payload, "quantity"), inf.payload?.fields);

  const badDate = await call("POST", "/api/orders", { ...validOrder, orderDate: "07.09.2026" });
  check("yanlis tarih bicimi -> 400", badDate.status === 400, badDate);
  check("orderDate alan hatasi", hasField(badDate.payload, "orderDate"), badDate.payload?.fields);

  const long = await call("POST", "/api/orders", { ...validOrder, customer: "A".repeat(201) });
  check("asiri uzun metin -> 400", long.status === 400, long);
  check("customer uzunluk hatasi", hasField(long.payload, "customer"), long.payload?.fields);

  const ok = await call("POST", "/api/orders", validOrder);
  check("gecerli siparis -> 201", ok.status === 201, ok);
}

console.log("\n2) Enum beyaz listesi — action ve status");
{
  const rmo = await call("POST", "/api/raw-material-orders/rmo-9/actions", {
    action: "skip_to_warehoused",
  });
  check("uydurma action -> 400", rmo.status === 400, rmo);
  check("action alan hatasi", hasField(rmo.payload, "action"), rmo.payload?.fields);

  const badStatus = await call("POST", "/api/orders", {
    ...validOrder,
    status: "warehoused",
  });
  check("uydurma siparis status -> 400", badStatus.status === 400, badStatus);
  check("status alan hatasi", hasField(badStatus.payload, "status"), badStatus.payload?.fields);

  const badRole = await call("POST", "/api/users", {
    username: "zod-test-user",
    name: "Zod Test",
    role: "SUPERADMIN",
    password: "YeniGuclu1Sifre",
  });
  check("uydurma rol -> 400", badRole.status === 400, badRole);
  check("role alan hatasi", hasField(badRole.payload, "role"), badRole.payload?.fields);
}

console.log("\n3) Dizi boyutu ve gecersiz JSON");
{
  const tooMany = await call("POST", "/api/recipes", {
    productName: "Zod Recete",
    lines: Array.from({ length: 201 }, (_, i) => ({
      materialName: `Madde ${i}`,
      unit: "mg",
      quantityPerUnit: 1,
    })),
  });
  check("201 recete satiri -> 400", tooMany.status === 400, tooMany);
  check("lines alan hatasi", hasField(tooMany.payload, "lines"), tooMany.payload?.fields);

  const emptyLines = await call("POST", "/api/recipes", {
    productName: "Bos",
    lines: [],
  });
  check("bos lines -> 400", emptyLines.status === 400, emptyLines);

  const junk = await call("POST", "/api/orders", null, "{not-json");
  check("gecersiz JSON -> 400", junk.status === 400, junk);
  check("JSON hata mesaji", typeof junk.payload?.error === "string", junk.payload);
}

console.log("\n4) Gövde boyutu siniri (1 MB)");
{
  const oversized = "x".repeat(MAX_JSON_BODY_BYTES + 1);
  const r = await call("POST", "/api/backups", null, oversized);
  check("1 MB+ govde -> 413", r.status === 413, r);
  check("buyukluk mesaji", typeof r.payload?.error === "string", r.payload);
}

console.log("\n5) Diger yazma uclari — negatif/NaN reddi");
{
  const stock = await call("POST", "/api/stock", {
    sku: "ZOD-1",
    name: "Test",
    category: "Ham Madde",
    warehouseId: "wh-fabrika",
    quantity: -1,
    unit: "kg",
    minStock: 0,
    lotNo: "L1",
    expiryDate: "2027-01-01",
  });
  check("negatif stok -> 400", stock.status === 400, stock);
  check("stok quantity alan hatasi", hasField(stock.payload, "quantity"), stock.payload?.fields);

  const line = await call("PATCH", "/api/production/lines", {
    id: "m050",
    patch: { efficiency: Number.NaN },
  });
  check("NaN efficiency -> 400", line.status === 400, line);

  const batch = await call("POST", "/api/production/batches", {
    product: "X",
    line: "Y",
    status: "planned",
    quantity: 0,
    unit: "adet",
    startDate: "2026-09-07",
    endDate: "2026-09-08",
    yield: 90,
    qcScore: 90,
  });
  check("sifir parti miktari -> 400", batch.status === 400, batch);
  check("batch quantity alan hatasi", hasField(batch.payload, "quantity"), batch.payload?.fields);

  const login = await call("POST", "/api/auth/login", { username: "", password: "" });
  check("bos giris -> 400", login.status === 400, login);
  check("username alan hatasi", hasField(login.payload, "username"), login.payload?.fields);
}

console.log(`\n${"=".repeat(46)}`);
console.log(`  GECEN: ${pass}   BASARISIZ: ${fail}`);
console.log("=".repeat(46));
process.exit(fail > 0 ? 1 : 0);
