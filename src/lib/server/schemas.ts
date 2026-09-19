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
  "queued",
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
const SAMPLE_SOURCE_KINDS = ["material", "product"] as const;
const SAMPLE_DISPOSITIONS = ["returned", "scrap"] as const;

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

export const orderShipmentSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, { error: "Geçersiz sipariş durumu" }).optional(),
    warehouse: optionalText(80),
    customer: optionalText(200),
    destination: optionalText(MAX_NOTE),
    shipmentNote: optionalText(MAX_NOTE),
    stockItemId: optionalText(MAX_ID),
    quantity: finiteNumber({ positive: true }).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.warehouse !== undefined ||
      value.customer !== undefined ||
      value.destination !== undefined ||
      value.shipmentNote !== undefined ||
      value.stockItemId !== undefined ||
      value.quantity !== undefined,
    {
      message: "Güncellenecek alan belirtilmedi",
    }
  );

export const shipmentCreateSchema = z.object({
  customer: text(200),
  destination: text(MAX_NOTE),
  stockItemId: text(MAX_ID),
  quantity: finiteNumber({ positive: true }),
  warehouse: optionalText(80),
  shipmentNote: optionalText(MAX_NOTE),
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
  code: optionalText(40),
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

export const batchPatchSchema = z.object({
  id: text(MAX_ID),
  action: z
    .enum(["complete_and_next", "start_next", "approve_qc", "reject_qc"])
    .optional(),
  patch: z
    .object({
      status: z.enum(BATCH_STATUSES, { error: "Geçersiz parti durumu" }).optional(),
    })
    .optional(),
  materialUsage: z
    .array(
      z.object({
        materialId: optionalText(MAX_ID).default(""),
        materialName: text(),
        unit: optionalText(40).default(""),
        estimated: finiteNumber({ min: 0 }),
        actual: finiteNumber({ min: 0 }),
      })
    )
    .optional(),
});

export const stockTransferCreateSchema = z.object({
  sourceItemId: text(MAX_ID),
  toWarehouseId: text(MAX_ID),
  quantity: finiteNumber({ positive: true }),
  reason: z
    .enum(
      ["replenishment", "direct_lab", "manual", "finished_direct", "istanbul_shipment"],
      { error: "Geçersiz aktarım türü" }
    )
    .optional()
    .default("manual"),
  note: optionalText(MAX_NOTE),
});

export const stockTransferAdvanceSchema = z.object({
  action: z.enum(["approve", "depart", "arrive"], {
    error: "Geçersiz sevkiyat adımı",
  }),
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
  productName: text(200),
  recipeCode: text(80),
  researcher: text(120),
  department: optionalText(80),
  startDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  priority: z
    .enum(EXPERIMENT_PRIORITIES, { error: "Geçersiz öncelik" })
    .optional(),
  materials: z
    .array(
      z.object({
        stockItemId: text(MAX_ID),
        quantity: finiteNumber({ positive: true }),
      })
    )
    .min(1, "En az bir hammadde seçin")
    .max(MAX_ARRAY),
});

export const experimentPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_material"),
    stockItemId: text(MAX_ID),
    quantity: finiteNumber({ positive: true }),
    reason: text(MAX_NOTE),
  }),
  z.object({
    action: z.literal("complete"),
    completionNote: optionalText(MAX_NOTE),
  }),
]);

export const sampleCreateSchema = z.object({
  sampleNo: optionalText(40),
  product: optionalText(),
  batchNo: optionalText(80),
  type: optionalText(80),
  status: z.enum(SAMPLE_STATUSES, { error: "Geçersiz numune durumu" }).optional(),
  receivedDate: isoDate,
  analyst: text(120),
  result: optionalText(500),
  quantity: finiteNumber({ positive: true }),
  unit: optionalText(40),
  stockItemId: text(MAX_ID),
  sourceKind: z.enum(SAMPLE_SOURCE_KINDS, { error: "Hammadde veya mamul seçin" }),
});

export const sampleCompleteSchema = z.object({
  disposition: z.enum(SAMPLE_DISPOSITIONS, {
    error: "Depoya iade veya ıskarta seçin",
  }),
  result: optionalText(500),
});

const supplierRelativeSchema = z.object({
  name: optionalText(120).default(""),
  phone: optionalText(40).default(""),
});

const supplierGuarantorSchema = z.object({
  name: optionalText(120).default(""),
  nationalId: optionalText(20).default(""),
  address: optionalText(MAX_NOTE).default(""),
  phone: optionalText(40).default(""),
});

export const customerCreateSchema = z.object({
  name: text(),
  contact: optionalText().default(""),
  address: optionalText(MAX_NOTE).default(""),
  invoiceName: optionalText().default(""),
  accountList: optionalText(80).default("Müşteri"),
  currency: optionalText(10).default("TL"),
  accountCode: optionalText(40).default(""),
  onlineTransactions: z.boolean({ error: boolMsg }).optional().default(true),
  notes: optionalText(2000).default(""),
  iban: optionalText(200).default(""),
  country: optionalText(80).default("Türkiye"),
  city: optionalText(80).default(""),
  district: optionalText(80).default(""),
  mobile: optionalText(40).default(""),
  email: optionalText(120).default(""),
  landline: optionalText(40).default(""),
  accountKind: optionalText(80).default("Gerçek kişi / Şahıs Firması"),
  taxNo: optionalText(40).default(""),
  taxOffice: optionalText(80).default(""),
  nationalId: optionalText(20).default(""),
  openingBalance: finiteNumber({ min: 0 }).optional().default(0),
  openingBalanceType: optionalText(40).default("Borçlu"),
  paymentTermDays: z
    .number({ error: numberMsg })
    .int("Tam sayı olmalıdır")
    .min(0, "En az 0 olmalıdır")
    .optional()
    .default(0),
  creditLimit: finiteNumber({ min: 0 }).optional().default(0),
  salesPriceList: optionalText(80).default("1. Satış Fiyatı"),
  branch: optionalText(80).default("Merkez Şube"),
  assignedPersonnel: optionalText(120).default(""),
  paymentTaxNo: optionalText(40).default(""),
  relatives: z.array(supplierRelativeSchema).max(4).optional().default([]),
  guarantors: z.array(supplierGuarantorSchema).max(2).optional().default([]),
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  active: z.boolean({ error: boolMsg }).optional(),
});

export const supplierCreateSchema = z.object({
  name: text(),
  contact: optionalText().default(""),
  address: optionalText(MAX_NOTE).default(""),
  invoiceName: optionalText().default(""),
  accountList: optionalText(80).default("Tedarikçi"),
  currency: optionalText(10).default("TL"),
  accountCode: optionalText(40).default(""),
  onlineTransactions: z.boolean({ error: boolMsg }).optional().default(true),
  notes: optionalText(2000).default(""),
  iban: optionalText(200).default(""),
  country: optionalText(80).default("Türkiye"),
  city: optionalText(80).default(""),
  district: optionalText(80).default(""),
  mobile: optionalText(40).default(""),
  email: optionalText(120).default(""),
  landline: optionalText(40).default(""),
  accountKind: optionalText(80).default("Gerçek kişi / Şahıs Firması"),
  taxNo: optionalText(40).default(""),
  taxOffice: optionalText(80).default(""),
  nationalId: optionalText(20).default(""),
  openingBalance: finiteNumber({ min: 0 }).optional().default(0),
  openingBalanceType: optionalText(40).default("Borçlu"),
  paymentTermDays: z
    .number({ error: numberMsg })
    .int("Tam sayı olmalıdır")
    .min(0, "En az 0 olmalıdır")
    .optional()
    .default(0),
  creditLimit: finiteNumber({ min: 0 }).optional().default(0),
  salesPriceList: optionalText(80).default("1. Satış Fiyatı"),
  branch: optionalText(80).default("Merkez Şube"),
  assignedPersonnel: optionalText(120).default(""),
  paymentTaxNo: optionalText(40).default(""),
  relatives: z.array(supplierRelativeSchema).max(4).optional().default([]),
  guarantors: z.array(supplierGuarantorSchema).max(2).optional().default([]),
});

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  active: z.boolean({ error: boolMsg }).optional(),
});

export const personnelCreateSchema = z.object({
  firstName: text(80),
  lastName: text(80),
  department: text(80),
  title: text(400),
  email: optionalText(120).default(""),
  phone: optionalText(40).default(""),
  hireDate: isoDate,
  salary: finiteNumber({ min: 0 }),
  iban: optionalText(40).default(""),
});

export const personnelUpdateSchema = personnelCreateSchema.partial();

const invoiceLineInputSchema = z.object({
  description: text(),
  quantityLabel: optionalText(80).default("1"),
  unitPrice: finiteNumber({ min: 0 }),
  lineTotal: finiteNumber({ min: 0 }).optional(),
  quantity: finiteNumber({ min: 0 }).optional(),
  unit: optionalText(40).default("Adet"),
  discountRate: finiteNumber({ min: 0, max: 100 }).optional(),
  vatRate: finiteNumber({ min: 0, max: 100 }).optional(),
  vatAmount: finiteNumber({ min: 0 }).optional(),
  lineNet: finiteNumber({ min: 0 }).optional(),
});

const invoiceFieldsSchema = z.object({
  invoiceNo: text(80),
  party: text(),
  kind: optionalText(40).default("Satış"),
  issueDate: isoDate,
  dueDate: isoDate,
  amount: finiteNumber({ min: 0 }).optional(),
  status: text(40),
  documentType: optionalText(40).default(""),
  bucket: optionalText(40).default(""),
  confirmed: z.boolean({ error: boolMsg }).optional(),
  eDocument: optionalText(40).default("e-Arşiv"),
  scenario: optionalText(40).default("TEMELFATURA"),
  series: optionalText(20).default(""),
  currency: optionalText(10).default("TRY"),
  fxRate: finiteNumber({ min: 0 }).optional(),
  partyTaxNo: optionalText(40).default(""),
  partyTaxOffice: optionalText(80).default(""),
  partyAddress: optionalText(MAX_NOTE).default(""),
  partyCity: optionalText(80).default(""),
  partyDistrict: optionalText(80).default(""),
  partyPhone: optionalText(40).default(""),
  partyEmail: optionalText(120).default(""),
  sellerName: optionalText().default("HamdPharma"),
  sellerTaxNo: optionalText(40).default(""),
  sellerTaxOffice: optionalText(80).default(""),
  sellerAddress: optionalText(MAX_NOTE).default(""),
  paymentMethod: optionalText(80).default("Cari hesap"),
  relatedDispatchNo: optionalText(80).default(""),
  relatedOrderNo: optionalText(80).default(""),
  notes: optionalText(2000).default(""),
  validUntil: optionalText(40).default(""),
  deliveryTerm: optionalText(200).default(""),
  preparedBy: optionalText(120).default(""),
  subtotal: finiteNumber({ min: 0 }).optional(),
  totalDiscount: finiteNumber({ min: 0 }).optional(),
  totalVat: finiteNumber({ min: 0 }).optional(),
  withholding: finiteNumber({ min: 0 }).optional(),
  lines: z
    .array(invoiceLineInputSchema)
    .max(MAX_ARRAY, `En fazla ${MAX_ARRAY} satır olabilir`)
    .optional(),
});

export const invoiceCreateSchema = invoiceFieldsSchema.refine(
  (data) => data.amount !== undefined || (data.lines && data.lines.length > 0),
  {
    message: "Tutar veya en az bir kalem zorunludur",
    path: ["amount"],
  }
);

export const invoiceUpdateSchema = invoiceFieldsSchema.partial();

const deliveryNoteLineInputSchema = z.object({
  description: text(),
  quantityLabel: text(80),
  unit: text(40),
});

const optionalTime = z
  .string({ error: textMsg })
  .trim()
  .refine((value) => value === "" || /^\d{2}:\d{2}$/.test(value), "SS:DD biçiminde olmalıdır")
  .optional();

export const deliveryNoteCreateSchema = z.object({
  noteNo: text(80),
  party: text(),
  kind: text(40),
  issueDate: isoDate,
  shipDate: isoDate,
  warehouse: text(80),
  relatedOrderNo: optionalText(80),
  relatedInvoiceNo: optionalText(80),
  relatedOrderDate: z.union([isoDate, z.literal("")]).optional(),
  status: text(40),
  partyTaxNo: optionalText(40).default(""),
  partyAddress: optionalText(MAX_NOTE).default(""),
  partyCity: optionalText(80).default(""),
  partyDistrict: optionalText(80).default(""),
  partyCountry: optionalText(80).default(""),
  partyPostalCode: optionalText(20).default(""),
  driverName: optionalText(120).default(""),
  driverNationalId: optionalText(20).default(""),
  plateNo: optionalText(40).default(""),
  trailerPlate: optionalText(40).default(""),
  plateOrigin: optionalText(80).default(""),
  shipMethod: optionalText(120).default(""),
  dispatchAddress: optionalText(MAX_NOTE).default(""),
  issueTime: optionalTime,
  shipTime: optionalTime,
  packages: optionalText(80).default(""),
  notes: optionalText(2000).default(""),
  lines: z
    .array(deliveryNoteLineInputSchema)
    .max(MAX_ARRAY, `En fazla ${MAX_ARRAY} satır olabilir`)
    .optional(),
});

export const deliveryNoteUpdateSchema = deliveryNoteCreateSchema.partial();

const chequeInstallmentInputSchema = z.object({
  dueDate: isoDate,
  amount: finiteNumber({ positive: true }),
  serialNo: optionalText(80).default(""),
});

const CHEQUE_STATUS_VALUES = [
  "Bekliyor",
  "Onaylandı",
  "Alındı",
  "Karşılıksız",
  "İptal",
] as const;

export const chequeNoteCreateSchema = z.object({
  kind: z.enum(["cek", "senet"]),
  direction: z.enum(["received", "given"]),
  party: text(),
  issueDate: isoDate,
  bankName: optionalText(120).default(""),
  serialNo: optionalText(80).default(""),
  currency: optionalText(10).default("TRY"),
  status: z.enum(CHEQUE_STATUS_VALUES).optional(),
  notes: optionalText(2000).default(""),
  relatedInvoiceNo: optionalText(80).default(""),
  installments: z
    .array(chequeInstallmentInputSchema)
    .min(1, "En az bir vade girin")
    .max(24, "En fazla 24 vade olabilir"),
});

export const chequeNoteUpdateSchema = chequeNoteCreateSchema.partial().extend({
  installments: z
    .array(chequeInstallmentInputSchema)
    .min(1, "En az bir vade girin")
    .max(24, "En fazla 24 vade olabilir")
    .optional(),
});

export const documentSettingsUpdateSchema = z.object({
  companyName: text(160),
  legalTitle: optionalText(200).default(""),
  taxOffice: optionalText(80).default(""),
  taxNo: optionalText(40).default(""),
  mersisNo: optionalText(40).default(""),
  tradeRegister: optionalText(80).default(""),
  address: optionalText(MAX_NOTE).default(""),
  city: optionalText(80).default(""),
  district: optionalText(80).default(""),
  phone: optionalText(40).default(""),
  email: optionalText(120).default(""),
  website: optionalText(120).default(""),
  iban: optionalText(40).default(""),
  bankName: optionalText(120).default(""),
  authorizedName: optionalText(120).default(""),
  footerNote: optionalText(2000).default(""),
  logoDataUrl: z
    .string({ error: textMsg })
    .max(900_000, "Logo çok büyük; 400 KB altı bir görsel kullanın")
    .refine(
      (value) =>
        !value ||
        value.startsWith("data:image/png") ||
        value.startsWith("data:image/jpeg") ||
        value.startsWith("data:image/jpg") ||
        value.startsWith("data:image/webp"),
      "Logo PNG, JPEG veya WebP olmalıdır"
    )
    .optional()
    .default(""),
  showLogo: z.boolean({ error: boolMsg }).optional().default(true),
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

export const budgetCashCreateSchema = z.object({
  direction: z.enum(["gelir", "gider"]),
  party: text(160),
  category: text(80),
  amount: finiteNumber({ positive: true }),
  date: isoDate,
  dueDate: z
    .string({ error: textMsg })
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "YYYY-MM-DD biçiminde olmalıdır")
    .optional(),
  description: optionalText(MAX_NOTE).optional(),
  invoiceNo: optionalText(80).optional(),
  cashAccountId: optionalText(80).optional(),
  receiptMode: z.enum(["invoice", "file"]).optional(),
});

export const budgetCashUpdateSchema = budgetCashCreateSchema.partial();

export const budgetCategoryCreateSchema = z.object({
  direction: z.enum(["gelir", "gider"]),
  name: text(80),
});

export const backupCreateSchema = z.object({
  note: optionalText(MAX_NOTE),
});

export const backupRestoreSchema = z.object({
  confirmFilename: text(200),
});

export const departmentCreateSchema = z.object({
  name: text(80),
});

export const departmentUpdateSchema = z.object({
  name: text(80),
});

export const jobTitleCreateSchema = z.object({
  name: text(80),
});

export const cashAccountCreateSchema = z.object({
  name: text(120),
  bankName: text(120),
  iban: optionalText(50),
  branch: optionalText(120),
  accountNo: optionalText(80),
  currency: optionalText(8),
  openingBalance: finiteNumber({ min: 0 }).optional(),
  notes: optionalText(MAX_NOTE),
});

export const cashAccountUpdateSchema = z.object({
  name: optionalText(120),
  bankName: optionalText(120),
  iban: optionalText(50),
  branch: optionalText(120),
  accountNo: optionalText(80),
  currency: optionalText(8),
  openingBalance: finiteNumber({ min: 0 }).optional(),
  notes: optionalText(MAX_NOTE),
});
