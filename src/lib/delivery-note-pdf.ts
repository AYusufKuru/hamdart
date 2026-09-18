import type { DeliveryNote, DeliveryNoteLine, DocumentSettings } from "@/data/catalog";
import { companyFooter, companyHeader, PDF_STYLES } from "@/lib/pdf-company";
import { loadPdfMake, pdfCell as cell } from "@/lib/pdf-make";
import { formatDate } from "@/lib/utils";

function dateTimeLabel(date: string, time?: string) {
  const formatted = formatDate(date);
  return time?.trim() ? `${formatted} ${time}` : formatted;
}

function partyLocation(note: DeliveryNote) {
  return [
    note.partyAddress,
    note.partyDistrict,
    note.partyCity,
    note.partyPostalCode,
    note.partyCountry,
  ]
    .filter(Boolean)
    .join(" / ");
}

export async function downloadDeliveryNotePdf(
  note: DeliveryNote,
  lines: DeliveryNoteLine[],
  settings: DocumentSettings
): Promise<void> {
  const pdfMake = await loadPdfMake();
  const kindLabel = note.kind === "Alış" ? "MAL KABUL İRSALİYESİ" : "SEVK İRSALİYESİ";

  const doc: Record<string, unknown> = {
    pageSize: "A4",
    pageMargins: [36, 32, 36, 44],
    info: {
      title: `${kindLabel} ${note.noteNo}`,
      author: settings.companyName || "HamdPharma",
    },
    content: [
      companyHeader(settings, kindLabel, note.status),
      {
        canvas: [{ type: "line", x1: 0, y1: 8, x2: 523, y2: 8, lineWidth: 1.4, lineColor: "#1e3a5f" }],
        margin: [0, 2, 0, 10],
      },
      {
        columns: [
          {
            width: "*",
            table: {
              widths: ["*"],
              body: [
                [{ text: "GÖNDERİCİ", bold: true, fontSize: 8, fillColor: "#e8eef5", margin: [4, 4, 4, 2] }],
                [
                  {
                    stack: [
                      { text: settings.legalTitle || settings.companyName, bold: true, fontSize: 9 },
                      { text: [settings.address, settings.district, settings.city].filter(Boolean).join(" / "), fontSize: 8 },
                      {
                        text: [
                          settings.taxOffice ? `VD: ${settings.taxOffice}` : "",
                          settings.taxNo ? `VN: ${settings.taxNo}` : "",
                        ]
                          .filter(Boolean)
                          .join("  "),
                        fontSize: 8,
                      },
                      { text: [settings.phone, settings.email].filter(Boolean).join("  ·  "), fontSize: 8 },
                    ],
                    margin: [4, 2, 4, 6],
                  },
                ],
              ],
            },
            layout: "noBorders",
          },
          { width: 10, text: "" },
          {
            width: "*",
            table: {
              widths: ["*"],
              body: [
                [{ text: "ALICI", bold: true, fontSize: 8, fillColor: "#e8eef5", margin: [4, 4, 4, 2] }],
                [
                  {
                    stack: [
                      { text: note.party, bold: true, fontSize: 9 },
                      { text: partyLocation(note) || " ", fontSize: 8 },
                      { text: note.partyTaxNo ? `VKN / TCKN: ${note.partyTaxNo}` : " ", fontSize: 8 },
                    ],
                    margin: [4, 2, 4, 6],
                  },
                ],
              ],
            },
            layout: "noBorders",
          },
        ],
      },
      {
        margin: [0, 8, 0, 8],
        table: {
          widths: ["auto", "*", "auto", "*"],
          body: [
            [
              cell("İrsaliye no", { bold: true }),
              cell(note.noteNo, { bold: true }),
              cell("İrsaliye tarihi"),
              cell(dateTimeLabel(note.issueDate, note.issueTime)),
            ],
            [
              cell("Sevk tarihi"),
              cell(dateTimeLabel(note.shipDate, note.shipTime)),
              cell("Depo"),
              cell(note.warehouse),
            ],
            [
              cell("İrsaliye adresi"),
              cell(note.dispatchAddress || note.warehouse),
              cell("Gönderim şekli"),
              cell(note.shipMethod),
            ],
            [
              cell("Sipariş no"),
              cell(note.relatedOrderNo),
              cell("Sipariş tarihi"),
              cell(note.relatedOrderDate ? formatDate(note.relatedOrderDate) : ""),
            ],
            [cell("Fatura no"), cell(note.relatedInvoiceNo), cell("Ambalaj / koli"), cell(note.packages)],
            [cell("Şoför"), cell(note.driverName), cell("TC kimlik"), cell(note.driverNationalId)],
            [cell("Plaka"), cell(note.plateNo), cell("Dorse plaka"), cell(note.trailerPlate)],
            [cell("Menşei"), cell(note.plateOrigin, { colSpan: 3 }), {}, {}],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: "Sevk edilen mallar", style: "section", margin: [0, 6, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: [22, "*", 70, 70],
          body: [
            [
              cell("#", { bold: true, fillColor: "#e8eef5" }),
              cell("Malın cinsi / açıklaması", { bold: true, fillColor: "#e8eef5" }),
              cell("Miktar", { bold: true, fillColor: "#e8eef5", alignment: "right" }),
              cell("Birim", { bold: true, fillColor: "#e8eef5" }),
            ],
            ...lines.map((line, i) => [
              cell(String(i + 1)),
              cell(line.description),
              cell(line.quantityLabel, { alignment: "right" }),
              cell(line.unit),
            ]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      note.notes
        ? { text: `Açıklama: ${note.notes}`, fontSize: 8, margin: [0, 10, 0, 0] }
        : { text: "" },
      {
        text: "İşbu sevk irsaliyesi 213 sayılı VUK hükümlerine göre düzenlenmiştir. Fatura yerine geçmez.",
        fontSize: 8,
        italics: true,
        margin: [0, 12, 0, 0],
      },
      {
        columns: [
          {
            width: "*",
            alignment: "center",
            margin: [0, 28, 0, 0],
            stack: [
              { text: "Teslim eden", fontSize: 8, bold: true },
              { text: note.driverName || settings.authorizedName || " ", fontSize: 8, margin: [0, 28, 0, 0] },
              { canvas: [{ type: "line", x1: 30, y1: 2, x2: 190, y2: 2, lineWidth: 0.5 }] },
            ],
          },
          {
            width: "*",
            alignment: "center",
            margin: [0, 28, 0, 0],
            stack: [
              { text: "Teslim alan", fontSize: 8, bold: true },
              { text: " ", fontSize: 8, margin: [0, 28, 0, 0] },
              { canvas: [{ type: "line", x1: 30, y1: 2, x2: 190, y2: 2, lineWidth: 0.5 }] },
            ],
          },
        ],
      },
      companyFooter(settings),
    ],
    styles: PDF_STYLES,
    defaultStyle: { fontSize: 9 },
  };

  const safeName = note.noteNo.replace(/[^\w.-]+/g, "_");
  await pdfMake.createPdf(doc).download(`${safeName}.pdf`);
}
