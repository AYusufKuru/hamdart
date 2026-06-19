import { WAREHOUSE_IDS } from "@/data/warehouses";

/** Hammadde tedarik siparişi yaşam döngüsü */
export type RawMaterialOrderStatus =
  | "to_order"
  | "ordered"
  | "received"
  | "qc_pending"
  | "warehoused"
  | "qc_failed"
  | "returned";

/** Listeye düşme kaynağı */
export type RawMaterialOrderSource =
  | "low_stock"
  | "production_need"
  | "manual";

export const rawMaterialOrderSourceLabels: Record<
  RawMaterialOrderSource,
  string
> = {
  low_stock: "Stok uyarısı (min. altı)",
  production_need: "Üretim / plan ihtiyacı",
  manual: "Manuel talep",
};

export interface RawMaterialOrder {
  id: string;
  orderNo: string;
  materialName: string;
  sku: string;
  supplier: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  status: RawMaterialOrderStatus;
  source: RawMaterialOrderSource;
  sourceNote?: string;
  targetWarehouseId: string;
  orderDate: string;
  expectedDelivery?: string;
  receivedDate?: string;
  qcStartedAt?: string;
  qcCompletedAt?: string;
  warehousedAt?: string;
  returnedAt?: string;
  lotNo?: string;
  invoiceNo?: string;
  qcNotes?: string;
  qcAnalyst?: string;
}

export const rawMaterialOrderStatusConfig: Record<
  RawMaterialOrderStatus,
  {
    label: string;
    description: string;
    variant: "secondary" | "info" | "warning" | "success" | "danger";
    step: number;
  }
> = {
  to_order: {
    label: "Sipariş Verilecek",
    description: "Tedarikçiye henüz sipariş verilmedi",
    variant: "secondary",
    step: 1,
  },
  ordered: {
    label: "Sipariş Verildi",
    description: "Tedarikçiye sipariş iletildi, sevkiyat bekleniyor",
    variant: "info",
    step: 2,
  },
  received: {
    label: "Fabrikaya Geldi",
    description: "Malzeme teslim alındı, kalite kontrole yönlendirilecek",
    variant: "info",
    step: 3,
  },
  qc_pending: {
    label: "Kalite Kontrolde",
    description: "KK analizi devam ediyor",
    variant: "warning",
    step: 4,
  },
  warehoused: {
    label: "Depoya Kaydedildi",
    description: "KK geçti, üretim malzemeleri deposuna işlendi",
    variant: "success",
    step: 5,
  },
  qc_failed: {
    label: "Kalite Reddi",
    description: "KK spesifikasyon dışı — iade süreci başlatılmalı",
    variant: "danger",
    step: 5,
  },
  returned: {
    label: "İade Edildi",
    description: "Geri fatura kesildi, ürün tedarikçiye iade edildi",
    variant: "danger",
    step: 6,
  },
};

/** Başarılı ana hat adımları (görsel akış) */
export const successFlowSteps: RawMaterialOrderStatus[] = [
  "to_order",
  "ordered",
  "received",
  "qc_pending",
  "warehoused",
];

export const seedRawMaterialOrders: RawMaterialOrder[] = [
  {
    id: "rmo-1",
    orderNo: "HM-2026-0089",
    materialName: "Sarı Kantaron Ekstresi (Hypericum)",
    sku: "RM-API-SK",
    supplier: "Botanik Ekstrakt Ltd.",
    quantity: 25,
    unit: "kg",
    unitPrice: 18500,
    totalPrice: 462500,
    status: "to_order",
    source: "production_need",
    sourceNote:
      "Yeni formülasyon (Sarı Kantaron) — üretim planından hammadde ihtiyacı",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-05-23",
    expectedDelivery: "2026-06-05",
  },
  {
    id: "rmo-2",
    orderNo: "HM-2026-0085",
    materialName: "CardioMax API",
    sku: "RM-API-CM",
    supplier: "ChemPure Global",
    quantity: 100,
    unit: "kg",
    unitPrice: 12500,
    totalPrice: 1250000,
    status: "ordered",
    source: "low_stock",
    sourceNote: "CardioMax API stoku üretim planı eşiğine yaklaştı",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-05-18",
    expectedDelivery: "2026-05-28",
    invoiceNo: "FTR-2026-8841",
  },
  {
    id: "rmo-3",
    orderNo: "HM-2026-0082",
    materialName: "NeuroRelief API",
    sku: "RM-API-NR",
    supplier: "SynTech Pharma",
    quantity: 50,
    unit: "kg",
    unitPrice: 18200,
    totalPrice: 910000,
    status: "received",
    source: "manual",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-05-15",
    receivedDate: "2026-05-22",
    invoiceNo: "FTR-2026-8790",
    lotNo: "API-NR-2026-042",
  },
  {
    id: "rmo-4",
    orderNo: "HM-2026-0078",
    materialName: "Povidon K30",
    sku: "RM-EXC-PVP",
    supplier: "Eksipiyan Tedarik A.Ş.",
    quantity: 200,
    unit: "kg",
    unitPrice: 420,
    totalPrice: 84000,
    status: "qc_pending",
    source: "low_stock",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-05-10",
    receivedDate: "2026-05-20",
    qcStartedAt: "2026-05-21",
    invoiceNo: "FTR-2026-8702",
    lotNo: "EXC-PVP-2026-118",
    qcAnalyst: "Uzm. Lab. Serkan Bulut",
  },
  {
    id: "rmo-5",
    orderNo: "HM-2026-0071",
    materialName: "ImmunoBoost Aktif",
    sku: "RM-API-IB",
    supplier: "ImmunoSource GmbH",
    quantity: 40,
    unit: "kg",
    unitPrice: 24000,
    totalPrice: 960000,
    status: "warehoused",
    source: "low_stock",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-05-01",
    receivedDate: "2026-05-12",
    qcStartedAt: "2026-05-13",
    qcCompletedAt: "2026-05-14",
    warehousedAt: "2026-05-14",
    invoiceNo: "FTR-2026-8610",
    lotNo: "API-IB-2026-0161",
    qcAnalyst: "Uzm. Lab. Aylin Korkmaz",
    qcNotes: "Tüm testler spesifikasyon dahilinde",
  },
  {
    id: "rmo-6",
    orderNo: "HM-2026-0065",
    materialName: "Sitrik Asit Anhidrat",
    sku: "RM-EXC-CA",
    supplier: "KimyaSan Endüstri",
    quantity: 500,
    unit: "kg",
    unitPrice: 95,
    totalPrice: 47500,
    status: "returned",
    source: "manual",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-04-20",
    receivedDate: "2026-04-28",
    qcStartedAt: "2026-04-29",
    qcCompletedAt: "2026-04-30",
    returnedAt: "2026-05-02",
    invoiceNo: "FTR-2026-8501",
    lotNo: "EXC-CA-2026-088",
    qcAnalyst: "Uzm. Lab. Deniz Polat",
    qcNotes: "Nem oranı limit üstü — parti reddedildi",
  },
  {
    id: "rmo-7",
    orderNo: "HM-2026-0068",
    materialName: "Magnezyum Stearat",
    sku: "RM-EXC-MGS",
    supplier: "Eksipiyan Tedarik A.Ş.",
    quantity: 80,
    unit: "kg",
    unitPrice: 195,
    totalPrice: 15600,
    status: "qc_failed",
    source: "manual",
    targetWarehouseId: WAREHOUSE_IDS.production,
    orderDate: "2026-04-25",
    receivedDate: "2026-05-05",
    qcStartedAt: "2026-05-06",
    qcCompletedAt: "2026-05-07",
    invoiceNo: "FTR-2026-8555",
    lotNo: "EXC-MGS-2026-044",
    qcAnalyst: "Uzm. Lab. Serkan Bulut",
    qcNotes: "Bulk yoğunluk testi başarısız",
  },
];
