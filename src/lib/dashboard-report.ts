import type {
  LabExperiment,
  Order,
  ProductionBatch,
  ProductionLine,
  StockItem,
} from "@/data/mock";
import {
  occupancyPercent,
  warehouseTypeLabels,
  type Warehouse,
} from "@/data/warehouses";
import { getAllLabExperiments } from "@/lib/lab-store";
import { getAllOrders } from "@/lib/order-store";
import {
  getAllProductionBatches,
  getAllProductionLines,
} from "@/lib/production-store";
import { syncReplenishmentOrders } from "@/lib/raw-material-order-store";
import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";
import { formatDate, formatNumber, todayIso } from "@/lib/utils";
import { getWarehouses } from "@/lib/warehouse-store";
import { ifAllowed } from "@/lib/api-client";

const NAVY = "#1e1b4b";
const INDIGO = "#4338ca";
const INDIGO_BAR = "#6366f1";
const MUTED = "#64748b";
const INK = "#0f172a";
const LINE = "#e2e8f0";
const ZEBRA = "#f8fafc";
const WHITE = "#ffffff";

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Bekliyor", color: "#b45309" },
  confirmed: { label: "Onaylandı", color: "#1d4ed8" },
  picking: { label: "Toplanıyor", color: "#1d4ed8" },
  shipped: { label: "Sevk Edildi", color: "#047857" },
  delivered: { label: "Teslim Edildi", color: "#047857" },
  cancelled: { label: "İptal", color: "#b91c1c" },
};

const ORDER_PRIORITY: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: MUTED },
  high: { label: "Yüksek", color: "#b45309" },
  urgent: { label: "Acil", color: "#b91c1c" },
};

const LINE_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Aktif", color: "#047857" },
  maintenance: { label: "Bakımda", color: "#b45309" },
  idle: { label: "Boşta", color: MUTED },
  alert: { label: "Uyarı", color: "#b91c1c" },
};

const BATCH_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: "Planlandı", color: "#1d4ed8" },
  in_progress: { label: "Üretimde", color: "#047857" },
  queued: { label: "Sırada", color: "#5b21b6" },
  qc_pending: { label: "KK Bekliyor", color: "#b45309" },
  completed: { label: "Tamamlandı", color: "#047857" },
  rejected: { label: "Reddedildi", color: "#b91c1c" },
};

const STOCK_STATUS: Record<string, { label: string; color: string }> = {
  normal: { label: "Normal", color: "#047857" },
  low: { label: "Düşük", color: "#b45309" },
  critical: { label: "Kritik", color: "#b91c1c" },
  expiring: { label: "SKT Yakın", color: "#b45309" },
};

const EXPERIMENT_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planlama", color: "#1d4ed8" },
  running: { label: "Devam Ediyor", color: "#047857" },
  analysis: { label: "Analiz", color: "#b45309" },
  approved: { label: "Onaylandı", color: "#047857" },
  on_hold: { label: "Beklemede", color: "#b91c1c" },
};

const OPEN_ORDER = new Set(["pending", "confirmed", "picking", "shipped"]);

type PdfNode = Record<string, unknown> | string | PdfNode[];

type PdfMake = {
  addVirtualFileSystem: (vfs: unknown) => void;
  createPdf: (doc: Record<string, unknown>) => {
    download: (name: string) => Promise<void>;
  };
};

let pdfMakeCache: PdfMake | null = null;

function unwrapModule<T>(mod: unknown): T {
  let current = mod as { default?: unknown; createPdf?: unknown };
  for (let i = 0; i < 4; i++) {
    if (current && typeof current.createPdf === "function") {
      return current as T;
    }
    if (current && current.default !== undefined) {
      current = current.default as { default?: unknown; createPdf?: unknown };
      continue;
    }
    break;
  }
  return current as T;
}

async function loadPdfMake(): Promise<PdfMake> {
  if (pdfMakeCache) return pdfMakeCache;
  const [pdfMod, fontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = unwrapModule<PdfMake>(pdfMod);
  const vfs =
    (fontsMod as { default?: unknown }).default ?? fontsMod;
  pdfMake.addVirtualFileSystem(vfs);
  pdfMakeCache = pdfMake;
  return pdfMake;
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text ? text : "—";
}

function money(value: number): string {
  return `₺${value.toLocaleString("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function qty(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`.trim();
}

function statusCell(
  map: Record<string, { label: string; color: string }>,
  key: string,
  rowIndex: number
): PdfNode {
  const item = map[key];
  return cell(item?.label ?? key, rowIndex, {
    color: item?.color ?? INK,
    bold: true,
  });
}

function cell(
  text: string,
  rowIndex: number,
  extra: Record<string, unknown> = {}
): PdfNode {
  return {
    text: dash(text),
    fontSize: 8,
    color: INK,
    fillColor: rowIndex % 2 === 0 ? ZEBRA : WHITE,
    margin: [0, 3, 0, 3],
    ...extra,
  };
}

function headerCell(text: string): PdfNode {
  return {
    text,
    bold: true,
    fontSize: 7.5,
    color: "#e0e7ff",
    fillColor: NAVY,
    margin: [0, 5, 0, 5],
  };
}

function tableLayout() {
  return {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 0.6 : 0.3,
    vLineWidth: () => 0,
    hLineColor: (i: number) => (i <= 1 ? NAVY : LINE),
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  };
}

function sectionTitle(title: string, subtitle?: string): PdfNode {
  return {
    margin: [0, 16, 0, 8],
    unbreakable: true,
    stack: [
      {
        columns: [
          {
            width: 4,
            canvas: [
              { type: "rect", x: 0, y: 1, w: 4, h: 13, color: INDIGO },
            ],
          },
          {
            text: title,
            fontSize: 12,
            bold: true,
            color: NAVY,
            margin: [8, 0, 0, 0],
          },
        ],
      },
      subtitle
        ? {
            text: subtitle,
            fontSize: 8,
            color: MUTED,
            margin: [12, 3, 0, 0],
          }
        : undefined,
    ].filter(Boolean),
  };
}

function emptyNote(message: string): PdfNode {
  return {
    text: message,
    italics: true,
    fontSize: 9,
    color: MUTED,
    margin: [12, 2, 0, 6],
  };
}

function kpiCard(
  label: string,
  value: string,
  hint: string,
  accent: string
): PdfNode {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                text: label.toUpperCase(),
                fontSize: 6.5,
                bold: true,
                color: MUTED,
                characterSpacing: 0.5,
              },
              {
                text: value,
                fontSize: 15,
                bold: true,
                color: NAVY,
                margin: [0, 4, 0, 3],
              },
              { text: hint, fontSize: 7.5, color: MUTED },
            ],
            fillColor: WHITE,
            margin: [8, 8, 8, 8],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.4,
      vLineWidth: (i: number) => (i === 0 ? 3.2 : 0.4),
      hLineColor: () => LINE,
      vLineColor: (i: number) => (i === 0 ? accent : LINE),
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
}

function dataTable(
  headers: string[],
  rows: PdfNode[][],
  widths: (string | number)[]
): PdfNode {
  return {
    table: {
      headerRows: 1,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths,
      body: [headers.map(headerCell), ...rows],
    },
    layout: tableLayout(),
  };
}

function rank(order: Record<string, number>, key: string, fallback: number) {
  return order[key] ?? fallback;
}

export async function generateDashboardPdf(options?: {
  generatedBy?: string;
}): Promise<void> {
  await ifAllowed(true, () => syncReplenishmentOrders(), []);
  const [orders, batches, lines, experiments, warehouseItems, warehouses] =
    await Promise.all([
      ifAllowed(true, () => getAllOrders(), []),
      ifAllowed(true, () => getAllProductionBatches(), []),
      ifAllowed(true, () => getAllProductionLines(), []),
      ifAllowed(true, () => getAllLabExperiments(), []),
      ifAllowed(true, () => getAllWarehouseStockItems(), []),
      ifAllowed(true, () => getWarehouses(), []),
    ]);

  const stock = toDisplayStockItems(warehouseItems);
  const alerts = stock.filter(
    (item) =>
      item.status === "low" ||
      item.status === "critical" ||
      item.status === "expiring"
  );
  const pdfMake = await loadPdfMake();
  const doc = buildReport({
    orders,
    batches,
    lines,
    experiments,
    stock,
    alerts,
    warehouses,
    generatedBy: options?.generatedBy,
  });
  await pdfMake.createPdf(doc).download(`hamdpharma-rapor-${todayIso()}.pdf`);
}

function buildReport(input: {
  orders: Order[];
  batches: ProductionBatch[];
  lines: ProductionLine[];
  experiments: LabExperiment[];
  stock: StockItem[];
  alerts: StockItem[];
  warehouses: Warehouse[];
  generatedBy?: string;
}): Record<string, unknown> {
  const dailyProduction = input.lines.reduce((s, l) => s + l.outputToday, 0);
  const productionTarget = input.lines.reduce((s, l) => s + l.targetToday, 0);
  const activeBatches = input.batches.filter((b) => b.status === "in_progress").length;
  const pendingOrders = input.orders.filter((o) => o.status === "pending").length;
  const urgentOrders = input.orders.filter(
    (o) =>
      o.priority === "urgent" &&
      o.status !== "delivered" &&
      o.status !== "cancelled"
  ).length;
  const activeLab = input.experiments.filter(
    (e) => e.status === "running" || e.status === "analysis"
  ).length;
  const openOrders = input.orders.filter((o) => OPEN_ORDER.has(o.status));
  const totalValue = input.orders.reduce((s, o) => s + o.value, 0);
  const openValue = openOrders.reduce((s, o) => s + o.value, 0);
  const capacity = input.warehouses.reduce((s, w) => s + w.capacity, 0);
  const used = input.warehouses.reduce((s, w) => s + w.used, 0);
  const utilization = occupancyPercent(used, capacity);
  const printedAt = new Date().toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "long",
    timeStyle: "short",
  });

  const sortedLines = [...input.lines].sort((a, b) => {
    const byStatus =
      rank({ active: 0, alert: 1, maintenance: 2, idle: 3 }, a.status, 9) -
      rank({ active: 0, alert: 1, maintenance: 2, idle: 3 }, b.status, 9);
    return byStatus || a.name.localeCompare(b.name, "tr");
  });
  const sortedOrders = [...input.orders].sort((a, b) => {
    const openDiff = Number(OPEN_ORDER.has(b.status)) - Number(OPEN_ORDER.has(a.status));
    if (openDiff) return openDiff;
    const byPriority =
      rank({ urgent: 0, high: 1, normal: 2 }, a.priority, 9) -
      rank({ urgent: 0, high: 1, normal: 2 }, b.priority, 9);
    if (byPriority) return byPriority;
    return a.deliveryDate.localeCompare(b.deliveryDate);
  });
  const sortedBatches = [...input.batches].sort((a, b) => {
    const byStatus =
      rank(
        { in_progress: 0, queued: 1, qc_pending: 2, planned: 3, completed: 4, rejected: 5 },
        a.status,
        9
      ) -
      rank(
        { in_progress: 0, queued: 1, qc_pending: 2, planned: 3, completed: 4, rejected: 5 },
        b.status,
        9
      );
    return byStatus || a.batchNo.localeCompare(b.batchNo, "tr");
  });
  const sortedAlerts = [...input.alerts].sort((a, b) => {
    const byStatus =
      rank({ critical: 0, low: 1, expiring: 2 }, a.status, 9) -
      rank({ critical: 0, low: 1, expiring: 2 }, b.status, 9);
    return byStatus || a.name.localeCompare(b.name, "tr");
  });
  const sortedExperiments = [...input.experiments].sort((a, b) => {
    const byStatus =
      rank(
        { running: 0, analysis: 1, planning: 2, on_hold: 3, approved: 4 },
        a.status,
        9
      ) -
      rank(
        { running: 0, analysis: 1, planning: 2, on_hold: 3, approved: 4 },
        b.status,
        9
      );
    return byStatus || a.code.localeCompare(b.code, "tr");
  });

  const preparedBy = input.generatedBy
    ? `Hazırlayan: ${input.generatedBy}`
    : "Canlı sistem verilerinden üretildi";

  return {
    pageSize: "A4",
    pageMargins: [32, 86, 32, 48],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: INK,
    },
    info: {
      title: "HamdPharma Genel Durum Raporu",
      author: input.generatedBy ?? "HamdPharma",
      creator: "HamdPharma",
      subject: `Üretim, sipariş, stok ve Ar-Ge özeti — ${printedAt}`,
    },
    header: () => ({
      table: {
        widths: ["*"],
        body: [
          [
            {
              border: [false, false, false, false],
              fillColor: NAVY,
              margin: [32, 16, 32, 12],
              columns: [
                {
                  stack: [
                    {
                      text: "HamdPharma",
                      color: WHITE,
                      fontSize: 16,
                      bold: true,
                    },
                    {
                      text: "İlaç Üretim Yönetim Sistemi",
                      color: "#a5b4fc",
                      fontSize: 8,
                      margin: [0, 2, 0, 0],
                    },
                  ],
                },
                {
                  stack: [
                    {
                      text: "GENEL DURUM RAPORU",
                      color: "#c7d2fe",
                      fontSize: 8,
                      bold: true,
                      alignment: "right",
                      characterSpacing: 1.1,
                    },
                    {
                      text: printedAt,
                      color: WHITE,
                      fontSize: 9,
                      alignment: "right",
                      margin: [0, 3, 0, 0],
                    },
                  ],
                },
              ],
            },
          ],
          [
            {
              border: [false, false, false, false],
              fillColor: INDIGO_BAR,
              text: " ",
              fontSize: 2,
              margin: [0, 0, 0, 0],
            },
          ],
        ],
      },
      layout: "noBorders",
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [32, 8, 32, 0],
      columns: [
        {
          text: "HamdPharma · İç kullanım",
          fontSize: 8,
          color: MUTED,
        },
        {
          text: `Sayfa ${currentPage} / ${pageCount}`,
          alignment: "right",
          fontSize: 8,
          color: MUTED,
        },
      ],
    }),
    content: [
      {
        text: preparedBy,
        fontSize: 8.5,
        color: MUTED,
        margin: [0, 0, 0, 12],
      },
      {
        columnGap: 8,
        columns: [
          kpiCard(
            "Günlük üretim",
            formatNumber(dailyProduction),
            `Hedef ${formatNumber(productionTarget)} adet`,
            INDIGO
          ),
          kpiCard(
            "Aktif batch",
            String(activeBatches),
            `${input.lines.length} üretim hattında`,
            "#2563eb"
          ),
          kpiCard(
            "Bekleyen sipariş",
            String(pendingOrders),
            `${urgentOrders} acil öncelikli`,
            "#7c3aed"
          ),
          kpiCard(
            "Ar-Ge deneyleri",
            String(input.experiments.length),
            `${activeLab} aktif test`,
            "#059669"
          ),
        ],
      },
      {
        margin: [0, 10, 0, 0],
        columnGap: 8,
        columns: [
          kpiCard(
            "Stok uyarıları",
            String(input.alerts.length),
            `${formatNumber(input.stock.length)} stok kalemi`,
            input.alerts.length ? "#dc2626" : "#059669"
          ),
          kpiCard(
            "Depo doluluk",
            `%${utilization}`,
            `${input.warehouses.length} depo`,
            "#0f766e"
          ),
          kpiCard(
            "Açık sipariş tutarı",
            money(openValue),
            `${openOrders.length} açık sipariş`,
            "#1d4ed8"
          ),
          kpiCard(
            "Tüm siparişler",
            money(totalValue),
            `${input.orders.length} kayıt`,
            NAVY
          ),
        ],
      },

      sectionTitle(
        "Depolar",
        `${input.warehouses.length} depo · toplam doluluk %${utilization}`
      ),
      input.warehouses.length === 0
        ? emptyNote("Kayıtlı depo yok.")
        : dataTable(
            ["Depo", "Tür", "Kullanım", "Kapasite", "Doluluk"],
            [...input.warehouses]
              .sort((a, b) => a.name.localeCompare(b.name, "tr"))
              .map((warehouse, i) => [
                cell(warehouse.name, i),
                cell(warehouseTypeLabels[warehouse.type] ?? warehouse.type, i),
                cell(formatNumber(warehouse.used), i, { alignment: "right" }),
                cell(formatNumber(warehouse.capacity), i, { alignment: "right" }),
                cell(`%${occupancyPercent(warehouse.used, warehouse.capacity)}`, i, {
                  alignment: "right",
                  bold: true,
                }),
              ]),
            ["*", 90, 70, 70, 55]
          ),

      sectionTitle(
        "Üretim hatları",
        `Bugün ${formatNumber(dailyProduction)} / ${formatNumber(productionTarget)} adet`
      ),
      sortedLines.length === 0
        ? emptyNote("Üretim hattı kaydı yok.")
        : dataTable(
            ["Hat", "Ürün", "Durum", "Bugün", "Hedef", "Verim", "Operatör"],
            sortedLines.map((line, i) => [
              cell(line.name, i, { bold: true }),
              cell(line.product, i),
              statusCell(LINE_STATUS, line.status, i),
              cell(formatNumber(line.outputToday), i, { alignment: "right" }),
              cell(formatNumber(line.targetToday), i, { alignment: "right" }),
              cell(`%${line.efficiency}`, i, { alignment: "right" }),
              cell(line.operator, i),
            ]),
            ["*", "*", 62, 50, 50, 42, 70]
          ),

      sectionTitle(
        "Siparişler",
        `${input.orders.length} sipariş · açık tutar ${money(openValue)} · bekleyen ${pendingOrders}`
      ),
      sortedOrders.length === 0
        ? emptyNote("Sipariş kaydı yok.")
        : dataTable(
            [
              "Sipariş",
              "Müşteri",
              "Ürün",
              "Miktar",
              "Durum",
              "Öncelik",
              "Teslim",
              "Tutar",
            ],
            sortedOrders.map((order, i) => [
              cell(order.orderNo, i, { bold: true }),
              cell(order.customer, i),
              cell(order.product, i),
              cell(qty(order.quantity, order.unit), i, { alignment: "right" }),
              statusCell(ORDER_STATUS, order.status, i),
              statusCell(ORDER_PRIORITY, order.priority, i),
              cell(formatDate(order.deliveryDate), i, { alignment: "right" }),
              cell(money(order.value), i, { alignment: "right" }),
            ]),
            [62, "*", "*", 58, 62, 42, 52, 58]
          ),

      sectionTitle(
        "Üretim partileri",
        `${input.batches.length} parti · ${activeBatches} üretimde`
      ),
      sortedBatches.length === 0
        ? emptyNote("Üretim partisi kaydı yok.")
        : dataTable(
            ["Parti", "Ürün", "Hat", "Durum", "Miktar", "Verim", "Başlangıç", "Bitiş"],
            sortedBatches.map((batch, i) => [
              cell(batch.batchNo, i, { bold: true }),
              cell(batch.product, i),
              cell(batch.line, i),
              statusCell(BATCH_STATUS, batch.status, i),
              cell(qty(batch.quantity, batch.unit), i, { alignment: "right" }),
              cell(`%${batch.yield}`, i, { alignment: "right" }),
              cell(formatDate(batch.startDate), i, { alignment: "right" }),
              cell(formatDate(batch.endDate), i, { alignment: "right" }),
            ]),
            [62, "*", "*", 62, 58, 38, 54, 54]
          ),

      sectionTitle(
        "Stok uyarıları",
        input.alerts.length
          ? `${input.alerts.length} kalem düşük, kritik veya SKT yakın`
          : "Kritik stok uyarısı yok"
      ),
      sortedAlerts.length === 0
        ? emptyNote("Düşük, kritik veya SKT yakın stok kalemi yok.")
        : dataTable(
            ["SKU", "Ürün", "Depo", "Miktar", "Min", "SKT", "Durum"],
            sortedAlerts.map((item, i) => [
              cell(item.sku, i, { bold: true }),
              cell(item.name, i),
              cell(item.warehouse, i),
              cell(qty(item.quantity, item.unit), i, { alignment: "right" }),
              cell(qty(item.minStock, item.unit), i, { alignment: "right" }),
              cell(formatDate(item.expiryDate), i, { alignment: "right" }),
              statusCell(STOCK_STATUS, item.status, i),
            ]),
            [62, "*", 78, 58, 52, 54, 52]
          ),

      sectionTitle(
        "Ar-Ge deneyleri",
        `${input.experiments.length} deney · ${activeLab} aktif`
      ),
      sortedExperiments.length === 0
        ? emptyNote("Deney kaydı yok.")
        : dataTable(
            ["Kod", "Deney", "Araştırmacı", "Durum", "İlerleme", "Termin"],
            sortedExperiments.map((exp, i) => [
              cell(exp.code, i, { bold: true }),
              cell(exp.title, i),
              cell(exp.researcher, i),
              statusCell(EXPERIMENT_STATUS, exp.status, i),
              cell(`%${exp.progress}`, i, { alignment: "right" }),
              cell(formatDate(exp.dueDate), i, { alignment: "right" }),
            ]),
            [58, "*", 80, 70, 48, 54]
          ),
    ],
  };
}
