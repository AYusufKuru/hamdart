import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";

export const MAX_TEXT = 200;
export const MAX_NOTE = 500;
export const MAX_ID = 80;
export const MAX_ARRAY = 200;
export const MAX_EXTRAS = 100;

const requiredMsg = "Zorunludur";
const textMsg = "Metin olmalıdır";
const numberMsg = "Geçerli bir sayı olmalıdır";
const finiteMsg = "Sonlu bir sayı olmalıdır";
const boolMsg = "true veya false olmalıdır";

export function text(max = MAX_TEXT) {
  return z
    .string({ error: textMsg })
    .trim()
    .min(1, requiredMsg)
    .max(max, `En fazla ${max} karakter olabilir`);
}

function optionalText(max = MAX_TEXT) {
  return z
    .string({ error: textMsg })
    .trim()
    .max(max, `En fazla ${max} karakter olabilir`)
    .optional();
}

function finiteNumber(opts?: { min?: number; max?: number; positive?: boolean }) {
  let schema = z
    .number({ error: numberMsg })
    .finite(finiteMsg);
  if (opts?.positive) {
    schema = schema.positive("Pozitif bir sayı olmalıdır");
  } else if (opts?.min !== undefined) {
    schema = schema.min(opts.min, `En az ${opts.min} olmalıdır`);
  }
  if (opts?.max !== undefined) {
    schema = schema.max(opts.max, `En fazla ${opts.max} olmalıdır`);
  }
  return schema;
}

export const isoDate = z
  .string({ error: textMsg })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD biçiminde olmalıdır");

const optionalIsoDate = z.union([isoDate, z.null()]).optional();

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "picking",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const ORDER_PRIORITIES = ["normal", "high", "urgent"] as const;

const RECIPE_STATUSES = ["draft", "saved"] as const;

const LINE_STATUSES = ["active", "maintenance", "idle", "alert"] as const;

const BATCH_STATUSES = [
  "planned",
  "in_progress",
  "qc_pending",
  "completed",
  "rejected",
] as const;

const STOCK_STATUSES = ["normal", "low", "critical", "expiring"] as const;

const RAW_MATERIAL_CATEGORIES = [
  "Paketleme",
  "Kimyasal",
  "Bitki",
  "Ekstrakt",
  "Kapsül",
  "Yağ",
  "Eksipiyan",
  "Etken madde",
  "Ham Madde",
  "Ambalaj",
  "Diğer",
] as const;

const RAW_MATERIAL_UNITS = ["kg", "g", "adet", "L", "mL"] as const;

const RMO_SOURCES = ["low_stock", "production_need", "manual"] as const;

const RMO_ACTIONS = [
  "place_order",
  "mark_received",
  "start_qc",
  "approve_qc",
  "reject_qc",
  "complete_return",
] as const;

const EXPERIMENT_STATUSES = [
  "planning",
  "running",
  "analysis",
  "approved",
  "on_hold",
] as const;

const SAMPLE_STATUSES = ["received", "testing", "approved", "rejected"] as const;

const EXPERIMENT_PRIORITIES = ["normal", "high"] as const;

export const loginBodySchema = z.object({
  username: text(64),
  password: z
    .string({ error: textMsg })
    .min(1, requiredMsg)
    .max(200, "En fazla 200 karakter olabilir"),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z
    .string({ error: textMsg })
    .min(1, requiredMsg)
    .max(200, "En fazla 200 karakter olabilir"),
  newPassword: z
    .string({ error: textMsg })
    .min(1, requiredMsg)
    .max(MAX_PASSWORD_BYTES, `En fazla ${MAX_PASSWORD_BYTES} karakter olabilir`),
});

export const userCreateSchema = z.object({
  username: z
    .string({ error: textMsg })
    .trim()
    .toLowerCase()
    .min(3, "Kullanıcı adı 3-32 karakter olmalıdır")
    .max(32, "Kullanıcı adı 3-32 karakter olmalıdır")
    .regex(
      /^[a-z0-9._-]+$/,
      "Kullanıcı adı yalnızca küçük harf, rakam, nokta, alt çizgi ve tire içerebilir"
    ),
  name: z
    .string({ error: textMsg })
    .trim()
    .min(2, "Ad soyad 2-120 karakter olmalıdır")
    .max(120, "Ad soyad 2-120 karakter olmalıdır"),
  role: z.enum(ROLES, { error: `Geçersiz rol. Geçerli roller: ${ROLES.join(", ")}` }),
  password: z
    .string({ error: textMsg })
    .min(MIN_PASSWORD_LENGTH, `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
    .max(MAX_PASSWORD_BYTES, `Şifre en fazla ${MAX_PASSWORD_BYTES} karakter olabilir`),
});

export const userUpdateSchema = z
  .object({
    name: z
      .string({ error: textMsg })
      .trim()
      .min(2, "Ad soyad 2-120 karakter olmalıdır")
      .max(120, "Ad soyad 2-120 karakter olmalıdır")
      .optional(),
    role: z
      .enum(ROLES, { error: `Geçersiz rol. Geçerli roller: ${ROLES.join(", ")}` })
      .optional(),
    active: z.boolean({ error: boolMsg }).optional(),
    password: z
      .string({ error: textMsg })
      .min(MIN_PASSWORD_LENGTH, `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
      .max(MAX_PASSWORD_BYTES, `Şifre en fazla ${MAX_PASSWORD_BYTES} karakter olabilir`)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Güncellenecek alan belirtilmedi",
  });

export const orderCreateSchema = z.object({
  customer: text(),
  product: text(),
  quantity: finiteNumber({ positive: true }),
  unit: text(40),
  status: z.enum(ORDER_STATUSES, { error: "Geçersiz sipariş durumu" }),
  orderDate: isoDate,
  deliveryDate: isoDate,
  priority: z.enum(ORDER_PRIORITIES, { error: "Geçersiz öncelik" }),
  warehouse: text(80),
  value: finiteNumber({ min: 0 }),
});

const recipeLineSchema = z.object({
  materialId: optionalText(MAX_ID).default(""),
  materialName: optionalText().default(""),
  unit: optionalText(40).default("mg"),
  quantityPerUnit: finiteNumber({ min: 0 }),
});

const recipeExtraSchema = z.object({
  id: optionalText(MAX_ID),
  materialId: text(MAX_ID),
  quantity: finiteNumber({ min: 0 }),
  reason: optionalText(MAX_NOTE).default(""),
});

function recipeLinesField() {
  return z
    .array(recipeLineSchema, { error: "lines bir dizi olmalıdır" })
    .min(1, "En az bir hammadde satırı zorunludur")
    .max(MAX_ARRAY, `En fazla ${MAX_ARRAY} satır olabilir`)
    .refine(
      (lines) =>
        lines.some(
          (line) =>
            (line.materialName || line.materialId) && line.quantityPerUnit > 0
        ),
      "En az bir hammadde satırı (ad ve miktar) zorunludur"
    );
}

export const recipeCreateSchema = z.object({
  code: optionalText(40),
  productCode: optionalText(80),
  productName: text(),
  lines: recipeLinesField(),
});

export const recipeUpdateSchema = z.object({
  id: text(MAX_ID),
  productName: optionalText(),
  productCode: optionalText(80),
  status: z.enum(RECIPE_STATUSES, { error: "Geçersiz reçete durumu" }).optional(),
  lines: recipeLinesField().optional(),
  extras: z
    .array(recipeExtraSchema, { error: "extras bir dizi olmalıdır" })
    .max(MAX_EXTRAS, `En fazla ${MAX_EXTRAS} ekstra satır olabilir`)
    .optional(),
});

export const rawMaterialCreateSchema = z.object({
  sku: text(80),
  name: text(),
  category: z.enum(RAW_MATERIAL_CATEGORIES, { error: "Geçersiz kategori" }),
  unit: z.enum(RAW_MATERIAL_UNITS, { error: "Geçersiz birim" }),
  unitCost: finiteNumber({ min: 0 }),
});

export const rmoCreateSchema = z.object({
  materialName: text(),
  sku: text(80),
  supplier: text(),
  quantity: finiteNumber({ positive: true }),
  unit: text(40),
  unitPrice: finiteNumber({ min: 0 }),
  source: z.enum(RMO_SOURCES, { error: "Geçersiz kaynak" }).optional(),
  sourceNote: optionalText(MAX_NOTE),
  targetWarehouseId: optionalText(MAX_ID),
  orderDate: isoDate.optional(),
  expectedDelivery: isoDate.optional(),
});

export const rmoPatchSchema = z.object({
  id: text(MAX_ID),
  supplier: optionalText(),
  quantity: finiteNumber({ min: 0 }).optional(),
  unitPrice: finiteNumber({ min: 0 }).optional(),
  unit: optionalText(40),
  expectedDelivery: optionalIsoDate,
  sourceNote: z
    .union([
      z
        .string({ error: textMsg })
        .trim()
        .max(MAX_NOTE, `En fazla ${MAX_NOTE} karakter olabilir`),
      z.null(),
    ])
    .optional(),
  targetWarehouseId: optionalText(MAX_ID),
});

export const rmoActionSchema = z.object({
  action: z.enum(RMO_ACTIONS, { error: "Geçersiz işlem" }),
});

export const emptyObjectSchema = z.object({});

export const productionLinePatchSchema = z.object({
  id: text(MAX_ID),
  patch: z
    .object({
      product: optionalText(),
      status: z.enum(LINE_STATUSES, { error: "Geçersiz hat durumu" }).optional(),
      operator: optionalText(120),
      currentBatch: optionalText(80),
      outputToday: finiteNumber({ min: 0 }).optional(),
      targetToday: finiteNumber({ min: 0 }).optional(),
      efficiency: finiteNumber({ min: 0, max: 100 }).optional(),
      lastMaintenance: isoDate.optional(),
    })
    .default({}),
});

export const batchCreateSchema = z.object({
  batchNo: optionalText(80),
  product: text(),
  line: text(120),
  status: z.enum(BATCH_STATUSES, { error: "Geçersiz parti durumu" }),
  quantity: finiteNumber({ positive: true }),
  unit: text(40),
  startDate: isoDate,
  endDate: isoDate,
  yield: finiteNumber({ min: 0, max: 999 }),
  qcScore: finiteNumber({ min: 0, max: 100 }),
});

export const stockTransferCreateSchema = z.object({
  sourceItemId: text(MAX_ID),
  toWarehouseId: text(MAX_ID),
  quantity: finiteNumber({ positive: true }),
  reason: z.enum(["replenishment", "direct_lab", "manual"], {
    error: "Geçersiz aktarım türü",
  }),
  note: optionalText(MAX_NOTE),
});

export const stockCreateSchema = z.object({
  sku: text(80),
  name: text(),
  category: text(80),
  warehouseId: text(MAX_ID),
  quantity: finiteNumber({ min: 0 }),
  unit: text(40),
  minStock: finiteNumber({ min: 0 }),
  lotNo: text(80),
  expiryDate: isoDate,
  status: z.enum(STOCK_STATUSES, { error: "Geçersiz stok durumu" }).optional(),
  temperature: optionalText(80),
  labDirectEntry: z.boolean({ error: boolMsg }).optional(),
  replenishFromWarehouseId: optionalText(MAX_ID),
  labTargetQuantity: finiteNumber({ min: 0 }).optional(),
});

export const experimentCreateSchema = z.object({
  code: optionalText(40),
  title: text(240),
  researcher: text(120),
  department: text(80),
  status: z.enum(EXPERIMENT_STATUSES, { error: "Geçersiz deney durumu" }),
  startDate: isoDate,
  dueDate: isoDate,
  progress: finiteNumber({ min: 0, max: 100 }),
  samples: z
    .number({ error: numberMsg })
    .finite(finiteMsg)
    .int("Tam sayı olmalıdır")
    .min(0, "En az 0 olmalıdır")
    .max(10000, "En fazla 10000 olmalıdır"),
  priority: z.enum(EXPERIMENT_PRIORITIES, { error: "Geçersiz öncelik" }),
});

export const sampleCreateSchema = z.object({
  sampleNo: optionalText(40),
  product: text(),
  batchNo: text(80),
  type: text(80),
  status: z.enum(SAMPLE_STATUSES, { error: "Geçersiz numune durumu" }),
  receivedDate: isoDate,
  analyst: text(120),
  result: optionalText(500),
});

export const customerCreateSchema = z.object({
  name: text(),
  contact: optionalText().default(""),
  address: optionalText(MAX_NOTE).default(""),
  taxNo: optionalText(40).default(""),
  email: optionalText(120).default(""),
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  active: z.boolean({ error: boolMsg }).optional(),
});

export const supplierCreateSchema = z.object({
  name: text(),
  contact: optionalText().default(""),
  address: optionalText(MAX_NOTE).default(""),
});

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  active: z.boolean({ error: boolMsg }).optional(),
});

export const personnelCreateSchema = z.object({
  firstName: text(80),
  lastName: text(80),
  department: text(80),
  title: text(120),
  email: optionalText(120).default(""),
  phone: optionalText(40).default(""),
  hireDate: isoDate,
  salary: finiteNumber({ min: 0 }),
  iban: optionalText(40).default(""),
});

export const personnelUpdateSchema = personnelCreateSchema.partial();

const invoiceLineInputSchema = z.object({
  description: text(),
  quantityLabel: text(80),
  unitPrice: finiteNumber({ min: 0 }),
  lineTotal: finiteNumber({ min: 0 }).optional(),
});

export const invoiceCreateSchema = z
  .object({
    invoiceNo: text(80),
    party: text(),
    kind: text(40),
    issueDate: isoDate,
    dueDate: isoDate,
    amount: finiteNumber({ min: 0 }).optional(),
    status: text(40),
    lines: z
      .array(invoiceLineInputSchema)
      .max(MAX_ARRAY, `En fazla ${MAX_ARRAY} satır olabilir`)
      .optional(),
  })
  .refine((data) => data.amount !== undefined || (data.lines && data.lines.length > 0), {
    message: "Tutar veya en az bir kalem zorunludur",
    path: ["amount"],
  });

export const invoiceUpdateSchema = z.object({
  invoiceNo: optionalText(80),
  party: optionalText(),
  kind: optionalText(40),
  issueDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  amount: finiteNumber({ min: 0 }).optional(),
  status: optionalText(40),
  lines: z
    .array(invoiceLineInputSchema)
    .max(MAX_ARRAY, `En fazla ${MAX_ARRAY} satır olabilir`)
    .optional(),
});

export const ledgerCreateSchema = z.object({
  date: isoDate,
  documentNo: text(80),
  description: text(),
  category: text(80),
  direction: text(40),
  amount: finiteNumber({ min: 0 }),
  status: text(40),
});

export const ledgerUpdateSchema = ledgerCreateSchema.partial();

export const budgetCreateSchema = z.object({
  department: text(80),
  annual: finiteNumber({ min: 0 }),
  spent: finiteNumber({ min: 0 }),
});

export const budgetUpdateSchema = budgetCreateSchema.partial();

export const backupCreateSchema = z.object({
  note: optionalText(MAX_NOTE),
});

export const backupRestoreSchema = z.object({
  confirmFilename: text(200),
});
