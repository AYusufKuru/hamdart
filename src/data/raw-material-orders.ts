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

