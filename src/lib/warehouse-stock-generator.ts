import type { StockStatus } from "@/data/mock";
import type { WarehouseStockItem } from "@/data/warehouses";
import { WAREHOUSE_IDS } from "@/data/warehouses";

const statuses: StockStatus[] = ["normal", "normal", "normal", "low", "critical", "expiring"];

function item(
  partial: Omit<WarehouseStockItem, "status"> & { status?: StockStatus },
  statusIndex: number
): WarehouseStockItem {
  return {
    ...partial,
    status: partial.status ?? statuses[statusIndex % statuses.length],
  };
}

/** Liste görünümü için ek örnek stok kalemleri */
export function generateExtendedWarehouseStock(): WarehouseStockItem[] {
  const out: WarehouseStockItem[] = [];
  let n = 0;

  const packagingCatalog = [
    ["Ambalaj", "Karton Kutu (20'li)", "adet", 12000],
    ["Ambalaj", "Blister Folyo PVC", "kg", 450],
    ["Ambalaj", "Şurup Şişesi 200ml", "adet", 6800],
    ["Ambalaj", "Damla Şişesi 30ml", "adet", 22000],
    ["Etiket", "NeuroRelief Etiket Rulosu", "adet", 420000],
    ["Etiket", "ImmunoBoost Etiket", "adet", 180000],
    ["Ambalaj", "Kapsül Blister Tablası", "adet", 95000],
    ["Ambalaj", "İnsülin Kalem Kutusu", "adet", 3200],
    ["Ambalaj", "Shrink Film Rulo", "kg", 280],
    ["Ambalaj", "Koli Bandı (şeffaf)", "adet", 840],
    ["Ambalaj", "Pediatrik Ölçü Kaşığı", "adet", 15000],
    ["Ambalaj", "IV Set Ambalaj Torbası", "adet", 4200],
    ["Etiket", "Seri No Barkod Etiketi", "adet", 1200000],
    ["Ambalaj", "Cam Şişe 500ml (amber)", "adet", 5600],
    ["Ambalaj", "Tıpa + Alüminyum Kapak Seti", "adet", 28000],
    ["Ambalaj", "Tablet Şişe 60cc", "adet", 44000],
    ["Ambalaj", "Laminat Sachet Film", "kg", 190],
    ["Etiket", "Braille Etiket Paneli", "adet", 32000],
    ["Ambalaj", "Soğuk Zincir Strafor", "adet", 890],
    ["Ambalaj", "Palet Streç Film", "rulo", 120],
  ] as const;

  for (const [cat, name, unit, qty] of packagingCatalog) {
    out.push(
      item(
        {
          id: `ws-p-gen-${n}`,
          sku: `PKG-GEN-${String(n).padStart(3, "0")}`,
          name,
          category: cat,
          warehouseId: WAREHOUSE_IDS.packaging,
          quantity: qty,
          unit,
          minStock: Math.round(qty * 0.35),
          lotNo: `PKG-2026-${4000 + n}`,
          expiryDate: `202${7 + (n % 3)}-${String((n % 12) + 1).padStart(2, "0")}-15`,
        },
        n++
      )
    );
  }

  const productionCatalog = [
    ["Ham Madde", "Laktoz Monohidrat", "kg", 4200],
    ["Eksipiyan", "Magnezyum Stearat", "kg", 380],
    ["Eksipiyan", "Kroskarmeloz Sodyum", "kg", 290],
    ["Ham Madde", "Pediatrik Syrup API", "kg", 85],
    ["Ham Madde", "Saline NaCl %0.9", "kg", 12000],
    ["Eksipiyan", "Titanyum Dioksit", "kg", 45],
    ["Ham Madde", "InsuCare Insulin Analog", "kg", 12],
    ["Eksipiyan", "HPMC Kapsül Dolgu", "kg", 520],
    ["Mamul", "NeuroRelief 25mg Tablet", "tablet", 890000],
    ["Mamul", "ImmunoBoost Plus Kapsül", "kapsül", 125000],
    ["Mamul", "Pediatrik Cough Syrup", "şişe", 8500],
    ["Mamul", "InsuCare Pen", "kalem", 4200],
    ["Mamul", "Saline IV 500ml", "adet", 18500],
    ["Ham Madde", "Sitrik Asit Anhidrat", "kg", 680],
    ["Eksipiyan", "Talk (farmasötik)", "kg", 210],
    ["Ham Madde", "Vitamin C API", "kg", 340],
    ["Eksipiyan", "Koloidal Silikon Dioksit", "kg", 95],
    ["Ham Madde", "Dextrose Monohidrat", "kg", 1800],
    ["Eksipiyan", "Sodyum Nişasta Glikolat", "kg", 140],
    ["Ham Madde", "Metformin API", "kg", 220],
    ["Mamul", "Metformin 850mg Tablet", "tablet", 560000],
    ["Eksipiyan", "Polietilen Glikol 400", "kg", 75],
    ["Ham Madde", "Asetaminofen API", "kg", 410],
    ["Eksipiyan", "Sunset Yellow (renklendirici)", "kg", 8],
    ["Ham Madde", "Omeprazol API", "kg", 28],
  ] as const;

  for (const [cat, name, unit, qty] of productionCatalog) {
    out.push(
      item(
        {
          id: `ws-m-gen-${n}`,
          sku: `RM-GEN-${String(n).padStart(3, "0")}`,
          name,
          category: cat,
          warehouseId: WAREHOUSE_IDS.production,
          quantity: qty,
          unit,
          minStock: Math.round(qty * 0.25),
          lotNo: `LOT-2026-${3000 + n}`,
          expiryDate: `202${7 + (n % 2)}-${String((n % 11) + 2).padStart(2, "0")}-28`,
        },
        n++
      )
    );
  }

  const labCatalog = [
    ["Numune", "ImmunoBoost QC Numunesi", "kapsül", 240],
    ["Ham Madde", "Pediatrik Syrup API (lab)", "g", 125],
    ["Eksipiyan", "Povidon K30 (lab)", "kg", 0.6],
    ["Referans Standart", "Metformin USP Referans", "g", 0.008],
    ["Numune", "Dissolüsyon Ortam pH 6.8", "L", 8],
    ["Numune", "Saline IV QC Numunesi", "adet", 24],
    ["Ham Madde", "Omeprazol API (lab)", "g", 45],
    ["Referans Standart", "İç Standart CardioMax", "g", 0.02],
    ["Numune", "Placebo Tablet (kör çalışma)", "tablet", 500],
    ["Ham Madde", "Vitamin C API (lab)", "g", 200],
    ["Eksipiyan", "Laktoz (lab ölçek)", "kg", 1.2],
    ["Referans Standart", "İzotopik İç Standart NR", "g", 0.003],
    ["Numune", "Mikrobiyoloji Besiyeri", "L", 12],
    ["Numune", "HPLC Mobil Faz Set A", "L", 4.5],
    ["Ham Madde", "InsuCare Analog (lab)", "mL", 15],
    ["Numune", "Stabilite Kabini Numunesi CM", "tablet", 800],
    ["Referans Standart", "Asetaminofen EP Referans", "g", 0.015],
    ["Numune", "Çözünmeyen Madde Filtresi", "adet", 120],
  ] as const;

  for (const [cat, name, unit, qty] of labCatalog) {
    const isRef = cat === "Referans Standart";
    out.push(
      item(
        {
          id: `ws-l-gen-${n}`,
          sku: `LAB-GEN-${String(n).padStart(3, "0")}`,
          name,
          category: cat,
          warehouseId: WAREHOUSE_IDS.laboratory,
          quantity: qty,
          unit,
          minStock: qty * 0.2,
          lotNo: `LAB-2026-${2000 + n}`,
          expiryDate: `202${6 + (n % 3)}-${String((n % 10) + 3).padStart(2, "0")}-20`,
          labDirectEntry: isRef,
          replenishFromWarehouseId: isRef
            ? undefined
            : WAREHOUSE_IDS.production,
          labTargetQuantity: isRef ? undefined : qty * 3,
        },
        n++
      )
    );
  }

  return out;
}
