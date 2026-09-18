import type { DocumentSettings, Invoice, InvoiceLine } from "@/data/catalog";
import { amountToWordsTr, documentTypeMeta } from "@/lib/invoice-docs";
import { companyFooter, companyHeader, PDF_STYLES } from "@/lib/pdf-company";
import { loadPdfMake, pdfCell as cell, pdfMoney as money } from "@/lib/pdf-make";
import { formatDate } from "@/lib/utils";

export async function downloadInvoicePdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  settings: DocumentSettings
): Promise<void> {
  const pdfMake = await loadPdfMake();
  const meta = documentTypeMeta(invoice.documentType || invoice.kind);
  const title = meta.label.toLocaleUpperCase("tr");
  const vatGroups = new Map<number, { net: number; vat: number }>();
  for (const line of lines) {
    const prev = vatGroups.get(line.vatRate) ?? { net: 0, vat: 0 };
    prev.net += line.lineNet;
    prev.vat += line.vatAmount;
    vatGroups.set(line.vatRate, prev);
  }

  const doc: Record<string, unknown> = {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 48],
    info: {
      title: `${title} ${invoice.invoiceNo}`,
      author: settings.companyName || "HamdPharma",
    },
    content: [
      companyHeader(
        settings,
        title,
        `${invoice.eDocument}${invoice.confirmed ? "  ·  KESİNLEŞEN" : "  ·  PROFORMA / TASLAK"}`
      ),
      {
        canvas: [{ type: "line", x1: 0, y1: 8, x2: 523, y2: 8, lineWidth: 1.2, lineColor: "#1e3a5f" }],
        margin: [0, 4, 0, 10],
      },
      {
        columns: [
          {
            width: "*",
            table: {
              widths: ["auto", "*"],
              body: [
                [cell(meta.partyKind === "supplier" ? "SATICI" : "ALICI", { bold: true, colSpan: 2, fillColor: "#eef2f7" }), {}],
                [cell("Unvan"), cell(invoice.party)],
                [
                  cell("Adres"),
                  cell([invoice.partyAddress, invoice.partyDistrict, invoice.partyCity].filter(Boolean).join(" / ")),
                ],
                [cell("Vergi Dairesi"), cell(invoice.partyTaxOffice)],
                [cell("VKN / TCKN"), cell(invoice.partyTaxNo)],
                [cell("Telefon"), cell(invoice.partyPhone)],
                [cell("E-posta"), cell(invoice.partyEmail)],
              ],
            },
            layout: "lightHorizontalLines",
          },
          { width: 12, text: "" },
          {
            width: 220,
            table: {
              widths: ["auto", "*"],
              body: [
                [cell("Belge No", { bold: true }), cell(invoice.invoiceNo, { bold: true })],
                [cell("Seri"), cell(invoice.series)],
                [cell("Düzenleme"), cell(formatDate(invoice.issueDate))],
                [cell("Vade"), cell(formatDate(invoice.dueDate))],
                [cell("Senaryo"), cell(invoice.scenario)],
                [cell("Para birimi"), cell(`${invoice.currency}  kur: ${invoice.fxRate}`)],
                [cell("Ödeme"), cell(invoice.paymentMethod)],
                [cell("Durum"), cell(invoice.status)],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      { text: "Mal / Hizmet", style: "section", margin: [0, 14, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 40, 32, 50, 32, 50, 38, 50, 55],
          body: [
            [
              cell("#", { bold: true, fillColor: "#e8eef5" }),
              cell("Açıklama", { bold: true, fillColor: "#e8eef5" }),
              cell("Miktar", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Birim", { bold: true, fillColor: "#e8eef5" }),
              cell("Birim fiyat", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("İsk. %", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Matrah", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("KDV %", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("KDV", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Tutar", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
            ],
            ...lines.map((line, i) => [
              cell(String(i + 1)),
              cell(line.description),
              cell(String(line.quantity), { alignment: "right" }),
              cell(line.unit),
              cell(money(line.unitPrice, invoice.currency), { alignment: "right" }),
              cell(String(line.discountRate), { alignment: "right" }),
              cell(money(line.lineNet, invoice.currency), { alignment: "right" }),
              cell(String(line.vatRate), { alignment: "right" }),
              cell(money(line.vatAmount, invoice.currency), { alignment: "right" }),
              cell(money(line.lineTotal, invoice.currency), { alignment: "right", bold: true }),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              invoice.relatedDispatchNo
                ? { text: `İrsaliye: ${invoice.relatedDispatchNo}`, fontSize: 8, margin: [0, 12, 0, 0] }
                : { text: "" },
              invoice.relatedOrderNo ? { text: `Sipariş: ${invoice.relatedOrderNo}`, fontSize: 8 } : { text: "" },
              invoice.notes ? { text: `Not: ${invoice.notes}`, fontSize: 8, margin: [0, 6, 0, 0] } : { text: "" },
              {
                text: `Yalnız: ${amountToWordsTr(invoice.amount)}`,
                fontSize: 8,
                italics: true,
                margin: [0, 10, 0, 0],
              },
            ],
          },
          {
            width: 220,
            margin: [0, 12, 0, 0],
            table: {
              widths: ["*", "auto"],
              body: [
                [cell("Mal / hizmet toplamı"), cell(money(invoice.subtotal, invoice.currency), { alignment: "right" })],
                [cell("İskonto"), cell(money(invoice.totalDiscount, invoice.currency), { alignment: "right" })],
                ...[...vatGroups.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([rate, g]) => [
                    cell(`KDV %${rate}`),
                    cell(money(g.vat, invoice.currency), { alignment: "right" }),
                  ]),
                [cell("Tevkifat / stopaj"), cell(money(invoice.withholding, invoice.currency), { alignment: "right" })],
                [
                  cell("Genel toplam", { bold: true, fillColor: "#e8eef5" }),
                  cell(money(invoice.amount, invoice.currency), {
                    alignment: "right",
                    bold: true,
                    fillColor: "#e8eef5",
                  }),
                ],
              ],
            },
            layout: "noBorders",
          },
        ],
      },
      {
        columns: [
          {
            width: "*",
            alignment: "center",
            margin: [0, 28, 0, 0],
            stack: [
              { text: "Düzenleyen", fontSize: 8, bold: true },
              { text: settings.authorizedName || " ", fontSize: 8, margin: [0, 24, 0, 0] },
              { canvas: [{ type: "line", x1: 40, y1: 2, x2: 180, y2: 2, lineWidth: 0.5 }] },
            ],
          },
          {
            width: "*",
            alignment: "center",
            margin: [0, 28, 0, 0],
            stack: [
              { text: "Kaşe / İmza", fontSize: 8, bold: true },
              { text: " ", fontSize: 8, margin: [0, 24, 0, 0] },
              { canvas: [{ type: "line", x1: 40, y1: 2, x2: 180, y2: 2, lineWidth: 0.5 }] },
            ],
          },
        ],
      },
      companyFooter(settings),
    ],
    styles: PDF_STYLES,
    defaultStyle: { fontSize: 9 },
  };

  const safeName = invoice.invoiceNo.replace(/[^\w.-]+/g, "_");
  await pdfMake.createPdf(doc).download(`${safeName}.pdf`);
}
