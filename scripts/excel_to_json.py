# -*- coding: utf-8 -*-
"""Excel GÜNCEL -> src/data/import/*.json"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from collections import defaultdict

ROOT = r"C:\Users\AYK\Desktop\hamdart"
SRC = os.path.join(ROOT, "src", "data", "import")
os.makedirs(SRC, exist_ok=True)

with open(os.path.join(ROOT, "_excel_full.json"), encoding="utf-8") as f:
    EXCEL = json.load(f)


def num(v, default=0.0):
    if v is None or v == "":
        return default
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "").replace("₺", "").replace(",", ".")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        return float(s) if s not in ("", ".", "-", "-.") else default
    except ValueError:
        return default


MOCK_MARKERS = (
    "cardiomax",
    "neurorelief",
    "örnek eczane",
    "ornek eczane",
    "örnek kimya",
    "ornek kimya",
    "medicare",
)


def is_mock_text(*parts: object) -> bool:
    blob = " ".join(str(p or "") for p in parts).casefold()
    return any(m in blob for m in MOCK_MARKERS)


def date_iso(v):
    if not v:
        return ""
    s = str(v).strip()
    s = s.replace(",", ".")
    m = re.match(r"^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})", s)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    m = re.match(r"^(\d{4})-(\d{2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-01"
    return s[:10] if len(s) >= 10 and s[4] == "-" else s


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("ı", "i").replace("ş", "s").replace("ğ", "g")
    s = s.replace("ü", "u").replace("ö", "o").replace("ç", "c")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "x"


def write(name, data):
    path = os.path.join(SRC, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print(name, len(data) if isinstance(data, list) else "obj")


# ---- warehouses
warehouses = []
seen_wh = set()
for i, r in enumerate(EXCEL["Depo"]["rows"], 1):
    name = (r.get("Depo Adı") or "").strip()
    desc = (r.get("Açıklama") or "").strip()
    wid = f"wh-{slug(name)}"
    if desc:
        candidate = f"{wid}-{slug(desc)}"
        if candidate not in seen_wh:
            wid = candidate
    if wid in seen_wh:
        wid = f"{wid}-{i}"
    seen_wh.add(wid)
    warehouses.append(
        {
            "id": wid,
            "name": name if not desc else f"{name} ({desc})",
            "excelName": name,
            "type": (r.get("Tip") or "Paketleme").strip(),
            "description": desc,
            "location": (r.get("Konum") or "").strip(),
            "capacity": num(r.get("Kapasite"), 0),
            "used": 0,
            "temperature": (r.get("Sıcaklık") or "").strip(),
            "humidity": (r.get("Nem") or "").strip(),
            "manager": (r.get("Sorumlu") or "").strip(),
            "items": 0,
            "lastAudit": "",
        }
    )

# Fabrika from stock / RMO
if not any(w["id"] == "wh-fabrika" for w in warehouses):
    warehouses.append(
        {
            "id": "wh-fabrika",
            "name": "Fabrika",
            "excelName": "FABRİKA",
            "type": "Üretim",
            "description": "Fabrika deposu",
            "location": "Fabrika",
            "capacity": 0,
            "used": 0,
            "temperature": "15-25°C",
            "humidity": "",
            "manager": "",
            "items": 0,
            "lastAudit": "",
        }
    )

warehouses.append(
    {
        "id": "wh-laboratory",
        "name": "Laboratuvar Deposu",
        "excelName": "Laboratuvar",
        "type": "Laboratuvar",
        "description": "Ar-Ge ve kalite kontrol",
        "location": "Fabrika",
        "capacity": 500,
        "used": 0,
        "temperature": "18-22°C",
        "humidity": "40-50%",
        "manager": "",
        "items": 0,
        "lastAudit": "",
    }
)


def map_warehouse(code: str) -> str:
    c = (code or "").strip().upper().replace("İ", "I")
    if not c:
        return "wh-fabrika"
    if "LAB" in c:
        return "wh-laboratory"
    if "SISE" in slug(code) or "ŞİŞE" in code.upper():
        hit = next((w["id"] for w in warehouses if "sise" in w["id"]), "")
        return hit or "wh-fabrika"
    if "AMBALAJ" in c:
        hit = next((w["id"] for w in warehouses if w["id"].startswith("wh-ambalaj")), "")
        return hit or "wh-fabrika"
    if "FABRIKA" in c.replace("İ", "I") or "ANA DEPO" in c:
        return "wh-fabrika"
    return "wh-fabrika"


write("warehouses.json", warehouses)

# ---- personnel
personnel = []
for i, r in enumerate(EXCEL["Personel"]["rows"], 1):
    personnel.append(
        {
            "id": f"p-{i}",
            "firstName": (r.get("Ad") or "").strip(),
            "lastName": (r.get("Soyad") or "").strip(),
            "department": (r.get("Departman") or "").strip(),
            "title": (r.get("Görev") or "").strip(),
            "email": (r.get("E-posta") or "").strip(),
            "phone": (r.get("Telefon") or "").strip(),
            "hireDate": date_iso(r.get("İşe Giriş Tarihi")),
            "salary": num(r.get("Maaş (₺)")),
            "iban": (r.get("IBAN") or "").strip(),
        }
    )
write("personnel.json", personnel)

# ---- raw materials
materials = []
sku_ids = {}
for i, r in enumerate(EXCEL["Hammadde"]["rows"], 1):
    sku = (r.get("SKU") or "").strip() or f"SKU-{i}"
    mid = f"rm-{slug(sku)}" if sku else f"rm-{i}"
    if mid in sku_ids:
        mid = f"{mid}-{i}"
    sku_ids[sku.lower()] = mid
    materials.append(
        {
            "id": mid,
            "sku": sku,
            "name": (r.get("Malzeme Adı") or "").strip(),
            "category": (r.get("Kategori") or "Diğer").strip(),
            "unit": (r.get("Birim") or "").strip().lower() or "adet",
            "unitCost": 0,
        }
    )
name_to_id = {}
for m in materials:
    name_to_id.setdefault(m["name"].casefold(), m["id"])
write("raw-materials.json", materials)

# ---- products
products = []
for i, r in enumerate(EXCEL["Mamul_Urun"]["rows"], 1):
    products.append(
        {
            "id": f"prd-{i}",
            "sku": (r.get("SKU") or "").strip(),
            "name": (r.get("Ürün Adı") or "").strip(),
            "unit": (r.get("Birim") or "kutu").strip().lower(),
            "minStock": num(r.get("Min Stok")),
            "maxStock": num(r.get("Max Stok")),
            "lotNo": (r.get("Parti No") or "").strip(),
            "expiryDate": date_iso(r.get("STT")),
        }
    )
write("products.json", products)

# ---- stock
stock = []
for i, r in enumerate(EXCEL["Stok"]["rows"], 1):
    qty = num(r.get("Miktar"))
    mn = num(r.get("Min Stok"))
    exp = date_iso(r.get("Son Kullanma Tarihi"))
    status = "normal"
    if mn > 0 and qty < mn * 0.5:
        status = "critical"
    elif mn > 0 and qty < mn:
        status = "low"
    stock.append(
        {
            "id": f"stk-{i}",
            "sku": (r.get("SKU") or "").strip(),
            "name": (r.get("Ürün / Malzeme Adı") or "").strip(),
            "category": (r.get("Kategori") or "").strip(),
            "warehouseId": map_warehouse(r.get("Depo Kodu") or ""),
            "warehouseCode": (r.get("Depo Kodu") or "").strip(),
            "quantity": qty,
            "unit": (r.get("Birim") or "").strip().lower(),
            "minStock": mn,
            "maxStock": num(r.get("Max Stok")),
            "lotNo": (r.get("Lot No-Parti") or "").strip(),
            "expiryDate": exp,
            "status": status,
            "temperature": (r.get("Sıcaklık (opsiyonel)") or "").strip() or None,
        }
    )
write("stock.json", stock)

# ---- suppliers / customers
suppliers = []
for i, r in enumerate(EXCEL["Tedarikçiler"]["rows"], 1):
    suppliers.append(
        {
            "id": f"sup-{i}",
            "name": (r.get("Firma Adı") or "").strip(),
            "contact": (r.get("İletişim") or "").strip(),
            "address": (r.get("Adres") or "").strip(),
        }
    )
write("suppliers.json", suppliers)

customers = []
for i, r in enumerate(EXCEL["Müşteriler"]["rows"], 1):
    customers.append(
        {
            "id": f"cus-{i}",
            "name": (r.get("Müşteri Adı") or "").strip(),
            "contact": (r.get("İletişim") or "").strip(),
            "address": (r.get("Adres") or "").strip(),
            "taxNo": (r.get("Vergi No") or "").strip(),
            "email": (r.get("E-posta") or "").strip(),
        }
    )
write("customers.json", customers)

# ---- invoices
invoices = []
for i, r in enumerate(EXCEL["Cari_Acik"]["rows"], 1):
    invoices.append(
        {
            "id": f"inv-{i}",
            "invoiceNo": (r.get("Fatura No") or "").strip(),
            "party": (r.get("Müşteri / Tedarikçi") or "").strip(),
            "kind": (r.get("Tür") or "").strip(),
            "issueDate": date_iso(r.get("Düzenleme Tarihi")),
            "dueDate": date_iso(r.get("Vade Tarihi")),
            "amount": num(r.get("Tutar (₺)")),
            "status": (r.get("Durum") or "").strip(),
        }
    )
write("invoices.json", invoices)

invoice_lines = []
for i, r in enumerate(EXCEL["Cari_Fatura_Kalemleri"]["rows"], 1):
    invoice_lines.append(
        {
            "id": f"il-{i}",
            "invoiceNo": (r.get("Fatura No") or "").strip(),
            "description": (r.get("Kalem Açıklaması") or "").strip(),
            "quantityLabel": str(r.get("Miktar") or "").strip(),
            "unitPrice": num(r.get("Birim Fiyat (₺)")),
            "lineTotal": num(r.get("Kalem Toplam (₺)")),
        }
    )
write("invoice-lines.json", invoice_lines)

# ---- RMO
STATUS_MAP = {
    "bekliyor": "to_order",
    "sipariş verilecek": "to_order",
    "sipariş verildi": "ordered",
    "geldi": "received",
    "geliş": "received",
    "kk": "qc_pending",
    "onay": "warehoused",
    "red": "qc_failed",
    "iade": "returned",
}
SOURCE_MAP = {
    "düşük stok": "low_stock",
    "üretim": "production_need",
    "manuel": "manual",
}
rmo = []
for i, r in enumerate(EXCEL["Hammadde_Siparisleri"]["rows"], 1):
    name = (r.get("Malzeme Adı") or "").strip()
    if is_mock_text(name, r.get("Tedarikçi"), r.get("Sipariş No")):
        continue
    st = (r.get("Durum") or "").strip().casefold()
    src = (r.get("Kaynak") or "").strip().casefold()
    mid = name_to_id.get(name.casefold(), "")
    sku = next((m["sku"] for m in materials if m["id"] == mid), "")
    status = STATUS_MAP.get(st, "received" if st else "to_order")
    rmo.append(
        {
            "id": f"rmo-{i}",
            "orderNo": (r.get("Sipariş No") or "").strip() or f"HM-2026-{i:04d}",
            "materialName": name,
            "sku": sku,
            "supplier": (r.get("Tedarikçi") or "").strip(),
            "quantity": num(r.get("Miktar")),
            "unit": (r.get("Birim") or "kg").strip().lower(),
            "unitPrice": num(r.get("Birim Fiyat (₺)")),
            "totalPrice": num(r.get("Toplam (₺)")),
            "status": status,
            "source": SOURCE_MAP.get(src, "manual" if not src else "low_stock"),
            "sourceNote": (r.get("Kaynak Notu") or "").strip() or None,
            "targetWarehouseId": map_warehouse(r.get("Hedef Depo Kodu") or ""),
            "orderDate": date_iso(r.get("Sipariş Tarihi")) or date_iso(r.get("Beklenen Teslimat")),
            "expectedDelivery": date_iso(r.get("Beklenen Teslimat")) or None,
            "receivedDate": date_iso(r.get("Teslim Alma Tarihi")) or None,
            "qcStartedAt": date_iso(r.get("KK Başlangıç")) or None,
            "qcCompletedAt": date_iso(r.get("KK Bitiş")) or None,
            "warehousedAt": date_iso(r.get("Depo Giriş Tarihi")) or None,
            "returnedAt": date_iso(r.get("İade Tarihi")) or None,
            "lotNo": (r.get("Lot No") or "").strip() or None,
            "invoiceNo": (r.get("Fatura No") or "").strip() or None,
            "qcAnalyst": (r.get("KK Analist") or "").strip() or None,
            "qcNotes": (r.get("KK Notları") or "").strip() or None,
        }
    )
write("raw-material-orders.json", rmo)

# ---- customer orders
ORDER_STATUS = {
    "bekliyor": "pending",
    "onaylandı": "confirmed",
    "onaylandi": "confirmed",
    "toplanıyor": "picking",
    "sevk edildi": "shipped",
    "teslim edildi": "delivered",
    "iptal": "cancelled",
}
orders = []
for i, r in enumerate(EXCEL["Müşteri_Siparişleri"]["rows"], 1):
    if is_mock_text(r.get("Müşteri Adı"), r.get("Ürün Adı"), r.get("Sipariş No")):
        continue
    st = (r.get("Durumu") or "").strip().casefold()
    pri = (r.get("Öncelik") or "normal").strip().lower()
    if pri not in ("normal", "high", "urgent"):
        pri = "normal"
    orders.append(
        {
            "id": f"o-{i}",
            "orderNo": (r.get("Sipariş No") or "").strip() or f"SIP-{i}",
            "customer": (r.get("Müşteri Adı") or "").strip(),
            "product": (r.get("Ürün Adı") or "").strip(),
            "quantity": num(r.get("Miktar")),
            "unit": (r.get("Birim") or "kutu").strip().lower(),
            "status": ORDER_STATUS.get(st, "confirmed"),
            "orderDate": date_iso(r.get("Sipariş Tarihi")),
            "deliveryDate": date_iso(r.get("Teslim Tarihi")),
            "priority": pri,
            "warehouse": "",
            "value": num(r.get("Tutar (₺)")),
            "recipeNo": (r.get("Reçete No") or "").strip(),
        }
    )
write("orders.json", orders)

# ---- recipes grouped by product
groups = defaultdict(list)
for r in EXCEL["Reçete"]["rows"]:
    pname = (r.get("Ürün adı") or "").strip()
    if not pname:
        continue
    groups[pname].append(r)

recipes = []
for i, (pname, rows) in enumerate(groups.items(), 1):
    code = (rows[0].get("Reçete Kodu") or "").strip() or f"REC-{i:03d}"
    pcode = (rows[0].get("Ürün Kodu") or "").strip()
    lines = []
    for j, r in enumerate(rows, 1):
        mname = (r.get("Hammadde adı") or "").strip()
        mid = name_to_id.get(mname.casefold(), "")
        lines.append(
            {
                "materialId": mid,
                "materialName": mname,
                "unit": (r.get("Birim") or "").strip(),
                "quantityPerUnit": num(r.get("Birim Miktar")),
            }
        )
    recipes.append(
        {
            "id": f"rec-{i}",
            "code": code,
            "productCode": pcode,
            "productName": pname,
            "orderId": "",
            "createdAt": "2026-01-01",
            "createdBy": "Sistem",
            "lines": lines,
            "extras": [],
            "status": "saved",
        }
    )
write("recipes.json", recipes)

# ---- machines / lines
lines = []
batches = []
for i, r in enumerate(EXCEL["Uretim_Hatlari"]["rows"], 1):
    code = (r.get("Makine Kodu") or f"M{i:03d}").strip()
    batch_no = str(r.get("Güncel Batch No") or "").strip()
    product = (r.get("Ürün") or "").strip()
    name = (r.get("Makine adı") or "").strip()
    out = int(num(r.get("Bugünkü Çıktı")))
    tgt = int(num(r.get("Günlük Hedef"))) or 1
    lines.append(
        {
            "id": code.lower(),
            "code": code,
            "name": name,
            "product": product,
            "status": "active",
            "efficiency": min(100, round(100 * out / tgt) if tgt else 0),
            "currentBatch": batch_no,
            "outputToday": out,
            "targetToday": tgt,
            "operator": (r.get("Operatör") or "").strip(),
            "lastMaintenance": "",
        }
    )
    if batch_no:
        batches.append(
            {
                "id": f"b-{i}",
                "batchNo": batch_no,
                "product": product,
                "line": name,
                "status": "in_progress",
                "quantity": out,
                "unit": "adet",
                "startDate": "2026-08-01",
                "endDate": "2026-08-31",
                "yield": min(100, round(100 * out / tgt) if tgt else 0),
                "qcScore": 0,
            }
        )
write("production-lines.json", lines)
write("production-batches.json", batches)

# ---- ledger / budget
ledger = []
for i, r in enumerate(EXCEL["Yevmiye_Defteri"]["rows"], 1):
    if is_mock_text(r.get("İşlem Açıklaması"), r.get("Belge No")):
        continue
    ledger.append(
        {
            "id": f"led-{i}",
            "date": date_iso(r.get("İşlem Tarihi")),
            "documentNo": (r.get("Belge No") or "").strip(),
            "description": (r.get("İşlem Açıklaması") or "").strip(),
            "category": (r.get("Kategori") or "").strip(),
            "direction": (r.get("Yön") or "").strip(),
            "amount": num(r.get("Tutar (₺)")),
            "status": (r.get("Durum") or "").strip(),
        }
    )
write("ledger.json", ledger)

budget = []
for i, r in enumerate(EXCEL["Bütçe"]["rows"], 1):
    budget.append(
        {
            "id": f"bud-{i}",
            "department": (r.get("Departman") or "").strip(),
            "annual": num(r.get("Yıllık Bütçe (₺)")),
            "spent": num(r.get("Harcanan (₺)")),
        }
    )
write("budget.json", budget)

print("done")
