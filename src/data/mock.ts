import { getWarehouseName, warehouseStockItems } from "@/data/warehouses";

export type ProductionLineStatus = "active" | "maintenance" | "idle" | "alert";
export type BatchStatus = "planned" | "in_progress" | "qc_pending" | "completed" | "rejected";
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
  warehouses,
  warehouseStockItems,
  stockTransfers,
  WAREHOUSE_IDS,
  getWarehouse,
  getWarehouseName,
  getStockByWarehouse,
  getLabItemsNeedingReplenishment,
  getCategoriesForWarehouse,
  getTransfersForWarehouse,
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
  dailyProduction: 847500,
  productionTarget: 920000,
  activeBatches: 12,
  pendingOrders: 34,
  stockAlerts: 7,
  labExperiments: 18,
  gmpCompliance: 98.4,
  warehouseUtilization: 76,
};

export const productionLines: ProductionLine[] = [
  {
    id: "line-1",
    name: "Tablet Hattı A",
    product: "CardioMax 50mg",
    status: "active",
    efficiency: 94,
    currentBatch: "BT-2026-0847",
    outputToday: 285000,
    targetToday: 300000,
    operator: "Ahmet Yılmaz",
    lastMaintenance: "2026-05-10",
  },
  {
    id: "line-2",
    name: "Tablet Hattı B",
    product: "NeuroRelief 25mg",
    status: "active",
    efficiency: 88,
    currentBatch: "BT-2026-0848",
    outputToday: 198000,
    targetToday: 220000,
    operator: "Elif Demir",
    lastMaintenance: "2026-05-08",
  },
  {
    id: "line-3",
    name: "Kapsül Hattı C",
    product: "ImmunoBoost Plus",
    status: "maintenance",
    efficiency: 0,
    currentBatch: "-",
    outputToday: 0,
    targetToday: 150000,
    operator: "-",
    lastMaintenance: "2026-05-23",
  },
  {
    id: "line-4",
    name: "Şurup Hattı D",
    product: "Pediatrik Cough Syrup",
    status: "active",
    efficiency: 91,
    currentBatch: "SR-2026-0124",
    outputToday: 12400,
    targetToday: 15000,
    operator: "Mehmet Kaya",
    lastMaintenance: "2026-05-05",
  },
  {
    id: "line-5",
    name: "Enjeksiyon Hattı E",
    product: "InsuCare Pen",
    status: "alert",
    efficiency: 72,
    currentBatch: "INJ-2026-0031",
    outputToday: 8500,
    targetToday: 12000,
    operator: "Zeynep Arslan",
    lastMaintenance: "2026-04-28",
  },
  {
    id: "line-6",
    name: "Steril Dolum Hattı F",
    product: "Saline IV 500ml",
    status: "idle",
    efficiency: 0,
    currentBatch: "-",
    outputToday: 0,
    targetToday: 8000,
    operator: "-",
    lastMaintenance: "2026-05-15",
  },
];

export const productionBatches: ProductionBatch[] = [
  {
    id: "b1",
    batchNo: "BT-2026-0847",
    product: "CardioMax 50mg",
    line: "Tablet Hattı A",
    status: "in_progress",
    quantity: 500000,
    unit: "tablet",
    startDate: "2026-05-22",
    endDate: "2026-05-24",
    yield: 96.2,
    qcScore: 0,
  },
  {
    id: "b2",
    batchNo: "BT-2026-0848",
    product: "NeuroRelief 25mg",
    line: "Tablet Hattı B",
    status: "qc_pending",
    quantity: 350000,
    unit: "tablet",
    startDate: "2026-05-21",
    endDate: "2026-05-23",
    yield: 94.8,
    qcScore: 97.5,
  },
  {
    id: "b3",
    batchNo: "SR-2026-0124",
    product: "Pediatrik Cough Syrup",
    line: "Şurup Hattı D",
    status: "in_progress",
    quantity: 25000,
    unit: "şişe",
    startDate: "2026-05-23",
    endDate: "2026-05-25",
    yield: 91.0,
    qcScore: 0,
  },
  {
    id: "b4",
    batchNo: "INJ-2026-0031",
    product: "InsuCare Pen",
    line: "Enjeksiyon Hattı E",
    status: "in_progress",
    quantity: 15000,
    unit: "kalem",
    startDate: "2026-05-22",
    endDate: "2026-05-26",
    yield: 88.5,
    qcScore: 0,
  },
  {
    id: "b5",
    batchNo: "BT-2026-0845",
    product: "CardioMax 50mg",
    line: "Tablet Hattı A",
    status: "completed",
    quantity: 480000,
    unit: "tablet",
    startDate: "2026-05-18",
    endDate: "2026-05-20",
    yield: 97.1,
    qcScore: 99.2,
  },
  {
    id: "b6",
    batchNo: "BT-2026-0843",
    product: "NeuroRelief 25mg",
    line: "Tablet Hattı B",
    status: "rejected",
    quantity: 320000,
    unit: "tablet",
    startDate: "2026-05-15",
    endDate: "2026-05-17",
    yield: 82.3,
    qcScore: 71.0,
  },
];

export const stockItems: StockItem[] = warehouseStockItems.map((item) => ({
  id: item.id,
  sku: item.sku,
  name: item.name,
  category: item.category,
  quantity: item.quantity,
  unit: item.unit,
  minStock: item.minStock,
  warehouse: getWarehouseName(item.warehouseId),
  warehouseId: item.warehouseId,
  lotNo: item.lotNo,
  expiryDate: item.expiryDate,
  status: item.status,
  temperature: item.temperature,
  labDirectEntry: item.labDirectEntry,
  replenishFromWarehouseId: item.replenishFromWarehouseId,
  labTargetQuantity: item.labTargetQuantity,
}));

export const orders: Order[] = [
  {
    id: "o1",
    orderNo: "SIP-2026-4521",
    customer: "MediCare Eczane Zinciri",
    product: "CardioMax 50mg",
    quantity: 50000,
    unit: "tablet",
    status: "confirmed",
    orderDate: "2026-05-22",
    deliveryDate: "2026-05-28",
    priority: "high",
    warehouse: "Üretim Malzemeleri Deposu",
    value: 425000,
  },
  {
    id: "o2",
    orderNo: "SIP-2026-4522",
    customer: "Anadolu Hastanesi",
    product: "Saline IV 500ml",
    quantity: 2000,
    unit: "adet",
    status: "picking",
    orderDate: "2026-05-21",
    deliveryDate: "2026-05-25",
    priority: "urgent",
    warehouse: "Paketleme Deposu",
    value: 86000,
  },
  {
    id: "o3",
    orderNo: "SIP-2026-4523",
    customer: "Global Pharma Export",
    product: "NeuroRelief 25mg",
    quantity: 120000,
    unit: "tablet",
    status: "pending",
    orderDate: "2026-05-23",
    deliveryDate: "2026-06-05",
    priority: "normal",
    warehouse: "Üretim Malzemeleri Deposu",
    value: 960000,
  },
  {
    id: "o4",
    orderNo: "SIP-2026-4518",
    customer: "Pediatri Kliniği",
    product: "Pediatrik Cough Syrup",
    quantity: 500,
    unit: "şişe",
    status: "shipped",
    orderDate: "2026-05-19",
    deliveryDate: "2026-05-23",
    priority: "normal",
    warehouse: "Paketleme Deposu",
    value: 22500,
  },
  {
    id: "o5",
    orderNo: "SIP-2026-4515",
    customer: "Diyabet Merkezi",
    product: "InsuCare Pen",
    quantity: 1500,
    unit: "kalem",
    status: "delivered",
    orderDate: "2026-05-15",
    deliveryDate: "2026-05-20",
    priority: "high",
    warehouse: "Üretim Malzemeleri Deposu",
    value: 675000,
  },
  {
    id: "o6",
    orderNo: "SIP-2026-4524",
    customer: "Eczane Kooperatifi",
    product: "ImmunoBoost Plus",
    quantity: 30000,
    unit: "kapsül",
    status: "pending",
    orderDate: "2026-05-23",
    deliveryDate: "2026-06-01",
    priority: "normal",
    warehouse: "Üretim Malzemeleri Deposu",
    value: 180000,
  },
  {
    id: "o7",
    orderNo: "SIP-2026-4510",
    customer: "Sağlık Bakanlığı",
    product: "CardioMax 50mg",
    quantity: 200000,
    unit: "tablet",
    status: "confirmed",
    orderDate: "2026-05-20",
    deliveryDate: "2026-06-10",
    priority: "urgent",
    warehouse: "Üretim Malzemeleri Deposu",
    value: 1700000,
  },
];

export const labExperiments: LabExperiment[] = [
  {
    id: "e1",
    code: "EXP-2026-041",
    title: "CardioMax Bioequivalence Study Phase III",
    researcher: "Dr. Selin Aktaş",
    department: "Formülasyon",
    status: "running",
    startDate: "2026-04-15",
    dueDate: "2026-06-30",
    progress: 68,
    samples: 240,
    priority: "high",
  },
  {
    id: "e2",
    code: "EXP-2026-042",
    title: "NeuroRelief Stability Test — 6 Month",
    researcher: "Dr. Emre Çelik",
    department: "Kalite Kontrol",
    status: "analysis",
    startDate: "2026-03-01",
    dueDate: "2026-05-30",
    progress: 85,
    samples: 120,
    priority: "normal",
  },
  {
    id: "e3",
    code: "EXP-2026-043",
    title: "ImmunoBoost New Excipient Evaluation",
    researcher: "Dr. Pınar Güneş",
    department: "Ar-Ge",
    status: "planning",
    startDate: "2026-05-25",
    dueDate: "2026-07-15",
    progress: 12,
    samples: 48,
    priority: "normal",
  },
  {
    id: "e4",
    code: "EXP-2026-038",
    title: "InsuCare Pen Needle Compatibility",
    researcher: "Dr. Kerem Yavuz",
    department: "Medikal Cihaz",
    status: "approved",
    startDate: "2026-02-10",
    dueDate: "2026-05-20",
    progress: 100,
    samples: 96,
    priority: "high",
  },
  {
    id: "e5",
    code: "EXP-2026-044",
    title: "Pediatrik Syrup Flavor Optimization",
    researcher: "Dr. Merve Akın",
    department: "Formülasyon",
    status: "running",
    startDate: "2026-05-10",
    dueDate: "2026-06-20",
    progress: 45,
    samples: 72,
    priority: "normal",
  },
  {
    id: "e6",
    code: "EXP-2026-039",
    title: "Microbial Limit Test — Batch BT-0843",
    researcher: "Dr. Hakan Özdemir",
    department: "Mikrobiyoloji",
    status: "on_hold",
    startDate: "2026-05-17",
    dueDate: "2026-05-25",
    progress: 30,
    samples: 36,
    priority: "high",
  },
];

export const labSamples: LabSample[] = [
  {
    id: "ls1",
    sampleNo: "SMP-2026-1847",
    product: "CardioMax 50mg",
    batchNo: "BT-2026-0847",
    type: "Üretim Numunesi",
    status: "testing",
    receivedDate: "2026-05-23",
    analyst: "Uzm. Lab. Aylin Korkmaz",
  },
  {
    id: "ls2",
    sampleNo: "SMP-2026-1848",
    product: "NeuroRelief 25mg",
    batchNo: "BT-2026-0848",
    type: "Stabilite",
    status: "testing",
    receivedDate: "2026-05-22",
    analyst: "Uzm. Lab. Serkan Bulut",
  },
  {
    id: "ls3",
    sampleNo: "SMP-2026-1845",
    product: "CardioMax 50mg",
    batchNo: "BT-2026-0845",
    type: "Serbest Bırakma",
    status: "approved",
    receivedDate: "2026-05-20",
    analyst: "Uzm. Lab. Aylin Korkmaz",
    result: "Spesifikasyon dahilinde",
  },
  {
    id: "ls4",
    sampleNo: "SMP-2026-1843",
    product: "NeuroRelief 25mg",
    batchNo: "BT-2026-0843",
    type: "Kalite Kontrol",
    status: "rejected",
    receivedDate: "2026-05-17",
    analyst: "Uzm. Lab. Serkan Bulut",
    result: "Dissolüsyon testi başarısız",
  },
  {
    id: "ls5",
    sampleNo: "SMP-2026-1850",
    product: "InsuCare Pen",
    batchNo: "INJ-2026-0031",
    type: "Sterilite",
    status: "received",
    receivedDate: "2026-05-23",
    analyst: "Uzm. Lab. Deniz Polat",
  },
];

export const productionChartData = [
  { month: "Oca", tablet: 4200000, capsule: 1800000, liquid: 85000 },
  { month: "Şub", tablet: 4500000, capsule: 1950000, liquid: 92000 },
  { month: "Mar", tablet: 4800000, capsule: 2100000, liquid: 98000 },
  { month: "Nis", tablet: 4650000, capsule: 2050000, liquid: 95000 },
  { month: "May", tablet: 5100000, capsule: 2200000, liquid: 105000 },
  { month: "Haz", tablet: 4950000, capsule: 2150000, liquid: 102000 },
];

export const stockChartData = [
  { category: "Kardiyoloji", value: 2450000 },
  { category: "Nöroloji", value: 890000 },
  { category: "Bağışıklık", value: 125000 },
  { category: "Pediatri", value: 8500 },
  { category: "Diyabet", value: 4200 },
  { category: "IV Sıvılar", value: 18500 },
];

export const recentActivities = [
  { id: 1, time: "10:42", message: "BT-2026-0847 batch üretimi %57 tamamlandı", type: "production" },
  { id: 2, time: "10:28", message: "SIP-2026-4522 siparişi toplama aşamasına alındı", type: "order" },
  { id: 3, time: "09:55", message: "InsuCare Pen stok seviyesi kritik eşiğin altında", type: "alert" },
  { id: 4, time: "09:30", message: "EXP-2026-038 deneyi onaylandı", type: "lab" },
  { id: 5, time: "08:15", message: "Laboratuvar deposu: CardioMax API aktarım talebi oluşturuldu", type: "warehouse" },
];
