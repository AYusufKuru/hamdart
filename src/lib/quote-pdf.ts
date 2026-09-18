import type { DocumentSettings, Invoice, InvoiceLine } from "@/data/catalog";
import { amountToWordsTr } from "@/lib/invoice-docs";
import { companyFooter, companyHeader, PDF_STYLES } from "@/lib/pdf-company";
import { loadPdfMake, pdfCell as cell, pdfMoney as money } from "@/lib/pdf-make";
import { formatDate } from "@/lib/utils";

export async function downloadQuotePdf(
  quote: Invoice,
  lines: InvoiceLine[],
  settings: DocumentSettings
): Promise<void> {
  const pdfMake = await loadPdfMake();
  const vatGroups = new Map<number, { net: number; vat: number }>();
  for (const line of lines) {
    const prev = vatGroups.get(line.vatRate) ?? { net: 0, vat: 0 };
    prev.net += line.lineNet;
    prev.vat += line.vatAmount;
    vatGroups.set(line.vatRate, prev);
  }

  const doc: Record<string, unknown> = {
    pageSize: "A4",
    pageMargins: [40, 36, 40, 48],
    info: {
      title: `Fiyat Teklifi ${quote.invoiceNo}`,
      author: settings.companyName || "HamdPharma",
    },
    content: [
      companyHeader(settings, "FİYAT TEKLİFİ", quote.status),
      {
        canvas: [{ type: "line", x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1.2, lineColor: "#1e3a5f" }],
        margin: [0, 4, 0, 12],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Sayın", fontSize: 8, color: "#555" },
              { text: quote.party, fontSize: 12, bold: true, margin: [0, 2, 0, 4] },
              {
                text: [quote.partyAddress, quote.partyDistrict, quote.partyCity].filter(Boolean).join(" / "),
                fontSize: 8,
                color: "#444",
              },
              quote.partyTaxNo ? { text: `VKN / TCKN: ${quote.partyTaxNo}`, fontSize: 8, color: "#444" } : { text: "" },
              quote.partyPhone ? { text: `Tel: ${quote.partyPhone}`, fontSize: 8, color: "#444" } : { text: "" },
            ],
          },
          {
            width: 210,
            table: {
              widths: ["auto", "*"],
              body: [
                [cell("Teklif no", { bold: true }), cell(quote.invoiceNo, { bold: true })],
                [cell("Tarih"), cell(formatDate(quote.issueDate))],
                [cell("Geçerlilik"), cell(formatDate(quote.validUntil || quote.dueDate))],
                [cell("Teslim"), cell(quote.deliveryTerm || "—")],
                [cell("Ödeme"), cell(quote.paymentMethod)],
                [cell("Para birimi"), cell(quote.currency)],
              ],
            },
            layout: "lightHorizontalLines",
          },
        ],
      },
      {
        text: "Aşağıdaki kalemler için fiyat teklifimizdir.",
        fontSize: 9,
        margin: [0, 14, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths: [18, "*", 42, 36, 58, 36, 52, 40, 58],
          body: [
            [
              cell("#", { bold: true, fillColor: "#e8eef5", color: "#1e3a5f" }),
              cell("Ürün / hizmet", { bold: true, fillColor: "#e8eef5", color: "#1e3a5f" }),
              cell("Miktar", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Birim", { bold: true, fillColor: "#e8eef5" }),
              cell("Birim fiyat", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("İsk. %", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Matrah", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("KDV %", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Tutar", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
            ],
            ...lines.map((line, i) => [
              cell(String(i + 1)),
              cell(line.description),
              cell(String(line.quantity), { alignment: "right" }),
              cell(line.unit),
              cell(money(line.unitPrice, quote.currency), { alignment: "right" }),
              cell(String(line.discountRate), { alignment: "right" }),
              cell(money(line.lineNet, quote.currency), { alignment: "right" }),
              cell(String(line.vatRate), { alignment: "right" }),
              cell(money(line.lineTotal, quote.currency), { alignment: "right", bold: true }),
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
              quote.notes
                ? {
                    text: [{ text: "Teklif şartları\n", bold: true }, quote.notes],
                    fontSize: 8,
                    margin: [0, 14, 12, 0],
                  }
                : { text: "" },
              {
                text: `Yalnız: ${amountToWordsTr(quote.amount)}`,
                fontSize: 8,
                italics: true,
                margin: [0, 10, 0, 0],
              },
            ],
          },
          {
            width: 200,
            margin: [0, 14, 0, 0],
            table: {
              widths: ["*", "auto"],
              body: [
                [cell("Ara toplam"), cell(money(quote.subtotal, quote.currency), { alignment: "right" })],
                ...[...vatGroups.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([rate, g]) => [
                    cell(`KDV %${rate}`),
                    cell(money(g.vat, quote.currency), { alignment: "right" }),
                  ]),
                [
                  cell("Teklif tutarı", { bold: true, fillColor: "#e8eef5" }),
                  cell(money(quote.amount, quote.currency), {
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
            margin: [0, 36, 0, 0],
            stack: [
              { text: "Hazırlayan", fontSize: 8, bold: true },
              { text: quote.preparedBy || settings.authorizedName || " ", fontSize: 8, margin: [0, 28, 0, 0] },
              { canvas: [{ type: "line", x1: 30, y1: 2, x2: 190, y2: 2, lineWidth: 0.5 }] },
            ],
          },
          {
            width: "*",
            alignment: "center",
            margin: [0, 36, 0, 0],
            stack: [
              { text: "Onay / Kaşe", fontSize: 8, bold: true },
              { text: " ", fontSize: 8, margin: [0, 28, 0, 0] },
              { canvas: [{ type: "line", x1: 30, y1: 2, x2: 190, y2: 2, lineWidth: 0.5 }] },
            ],
          },
        ],
      },
      companyFooter(
        settings,
        "Bu teklif belirtilen geçerlilik tarihine kadar geçerlidir. Fatura niteliği taşımaz."
      ),
    ],
    styles: PDF_STYLES,
    defaultStyle: { fontSize: 9 },
  };

  const safeName = quote.invoiceNo.replace(/[^\w.-]+/g, "_");
  await pdfMake.createPdf(doc).download(`${safeName}.pdf`);
}
