
export type ProductionLineStatus = "active" | "maintenance" | "idle" | "alert";
export type BatchStatus = "planned" | "in_progress" | "queued" | "qc_pending" | "completed" | "rejected";
export type StockStatus = "normal" | "low" | "critical" | "expiring";
export type OrderStatus = "pending" | "confirmed" | "picking" | "shipped" | "delivered" | "cancelled";
export type ExperimentStatus = "planning" | "running" | "analysis" | "approved" | "on_hold";
export type WarehouseZone = "ambient" | "cold" | "controlled" | "hazmat";

export interface DashboardStats {
  dailyProduction: number;
  productionTarget: number;
  activeBatches: number;
  pendingOrders: number;
  stockAlerts: number;
  labExperiments: number;
  gmpCompliance: number;
  warehouseUtilization: number;
}

export interface ProductionLine {
  id: string;
  code?: string;
  name: string;
  product: string;
  status: ProductionLineStatus;
  efficiency: number;
  currentBatch: string;
  outputToday: number;
  targetToday: number;
  operator: string;
  lastMaintenance: string;
}

export interface ProductionBatch {
  id: string;
  batchNo: string;
  product: string;
  line: string;
  status: BatchStatus;
  queuePosition: number | null;
  quantity: number;
  unit: string;
  startDate: string;
  endDate: string;
  yield: number;
  qcScore: number;
}

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock: number;
  warehouse: string;
  warehouseId: string;
  lotNo: string;
  expiryDate: string;
  status: StockStatus;
  temperature?: string;
  labDirectEntry?: boolean;
  replenishFromWarehouseId?: string;
  labTargetQuantity?: number;
}

export type { Warehouse, WarehouseStockItem, StockTransfer } from "@/data/warehouses";
export {
  WAREHOUSE_IDS,
  getWarehouse,
  getWarehouseName,
  warehouseTypeLabels,
} from "@/data/warehouses";

export interface Order {
  id: string;
  orderNo: string;
  customer: string;
  product: string;
  quantity: number;
  unit: string;
  status: OrderStatus;
  orderDate: string;
  deliveryDate: string;
  priority: "normal" | "high" | "urgent";
  warehouse: string;
  value: number;
  recipeNo?: string;
}

export interface LabExperiment {
  id: string;
  code: string;
  title: string;
  researcher: string;
  department: string;
  status: ExperimentStatus;
  startDate: string;
  dueDate: string;
  progress: number;
  samples: number;
  priority: "normal" | "high";
}

export interface LabSample {
  id: string;
  sampleNo: string;
  product: string;
  batchNo: string;
  type: string;
  status: "received" | "testing" | "approved" | "rejected";
  receivedDate: string;
  analyst: string;
  result?: string;
}

export const dashboardStats: DashboardStats = {
  dailyProduction: 0,
  productionTarget: 0,
  activeBatches: 0,
  pendingOrders: 0,
  stockAlerts: 0,
  labExperiments: 0,
  gmpCompliance: 0,
  warehouseUtilization: 0,
};

export const productionLines: ProductionLine[] = [];

export const productionBatches: ProductionBatch[] = [];

export const stockItems: StockItem[] = [];

export const orders: Order[] = [];

export const labExperiments: LabExperiment[] = [];

export const labSamples: LabSample[] = [];

export const productionChartData: { month: string; tablet: number; capsule: number; liquid: number }[] = [];

export const stockChartData: { category: string; value: number }[] = [];

export const recentActivities: {
  id: number;
  time: string;
  message: string;
  type: string;
}[] = [];
