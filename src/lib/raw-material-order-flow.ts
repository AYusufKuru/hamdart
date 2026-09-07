import type {
  RawMaterialOrder,
  RawMaterialOrderStatus,
} from "@/data/raw-material-orders";
import { rawMaterialOrderStatusConfig } from "@/data/raw-material-orders";

export type RawMaterialOrderAction =
  | "place_order"
  | "mark_received"
  | "start_qc"
  | "approve_qc"
  | "reject_qc"
  | "complete_return";

const transitions: Record<
  RawMaterialOrderStatus,
  Partial<Record<RawMaterialOrderAction, RawMaterialOrderStatus>>
> = {
  to_order: { place_order: "ordered" },
  ordered: { mark_received: "received" },
  received: { start_qc: "qc_pending" },
  qc_pending: {
    approve_qc: "warehoused",
    reject_qc: "qc_failed",
  },
  qc_failed: { complete_return: "returned" },
  warehoused: {},
  returned: {},
};

export const actionLabels: Record<
  RawMaterialOrderAction,
  { label: string; description: string; variant?: "default" | "destructive" }
> = {
  place_order: {
    label: "Siparişi Ver",
    description: "Tedarikçiye sipariş iletildi olarak işaretle",
  },
  mark_received: {
    label: "Fabrikaya Geldi",
    description: "Malzeme teslim alındı",
  },
  start_qc: {
    label: "Kalite Kontrole Al",
    description: "Numune KK birimine yönlendir",
  },
  approve_qc: {
    label: "KK Onayla — Depoya Kaydet",
    description: "Spesifikasyon uygun, stok girişi yapılır",
  },
  reject_qc: {
    label: "KK Reddet",
    description: "Spesifikasyon dışı — iade süreci",
    variant: "destructive",
  },
  complete_return: {
    label: "İadeyi Tamamla",
    description: "Geri fatura kesildi, ürün iade edildi",
    variant: "destructive",
  },
};

export function getAvailableActions(
  status: RawMaterialOrderStatus
): RawMaterialOrderAction[] {
  return Object.keys(transitions[status] ?? {}) as RawMaterialOrderAction[];
}

export function isSuccessPath(status: RawMaterialOrderStatus): boolean {
  return status === "warehoused";
}

export function isFailurePath(status: RawMaterialOrderStatus): boolean {
  return status === "qc_failed" || status === "returned";
}

export function getFlowStepState(
  orderStatus: RawMaterialOrderStatus,
  stepStatus: RawMaterialOrderStatus
): "done" | "current" | "upcoming" | "failed" | "skipped" {
  const orderStep = rawMaterialOrderStatusConfig[orderStatus]?.step ?? 1;
  const step = rawMaterialOrderStatusConfig[stepStatus]?.step ?? 1;

  if (isFailurePath(orderStatus)) {
    if (stepStatus === "qc_failed" || stepStatus === "returned") {
      return orderStatus === stepStatus ? "current" : step < orderStep ? "done" : "upcoming";
    }
    if (stepStatus === "warehoused") return "skipped";
    return step < 5 ? (step < orderStep ? "done" : step === orderStep ? "current" : "upcoming") : "skipped";
  }

  if (step < orderStep) return "done";
  if (step === orderStep) return "current";
  return "upcoming";
}

/** @deprecated Sunucu tarafında applyRawMaterialOrderActionApi kullanın */
export function applyAction(
  order: RawMaterialOrder,
  action: RawMaterialOrderAction
): RawMaterialOrder {
  const next = transitions[order.status]?.[action];
  if (!next) return order;
  return { ...order, status: next };
}
