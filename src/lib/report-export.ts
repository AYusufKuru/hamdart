import * as XLSX from "xlsx";
import { toast } from "sonner";
import { loadPdfMake, pdfCell as cell } from "@/lib/pdf-make";
import { todayIso } from "@/lib/utils";
import type { ReportColumn, ReportTableRow } from "@/lib/reports";

function safeFileName(title: string) {
  return title.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "rapor";
}

function sheetName(title: string) {
  return title.slice(0, 31) || "Rapor";
}

function tableMatrix(columns: ReportColumn[], rows: ReportTableRow[]) {
  const header = columns.map((col) => col.header);
  const body = rows.map((row) => columns.map((col) => row[col.key] ?? ""));
  return [header, ...body];
}

export function downloadReportExcel(
  title: string,
  columns: ReportColumn[],
  rows: ReportTableRow[]
) {
  if (rows.length === 0) {
    toast.error("Çıktı için kayıt yok");
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet(tableMatrix(columns, rows));
  ws["!cols"] = columns.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName(title));
  XLSX.writeFile(wb, `${safeFileName(title)}.xlsx`);
}

export async function downloadReportPdf(
  title: string,
  columns: ReportColumn[],
  rows: ReportTableRow[]
) {
  if (rows.length === 0) {
    toast.error("Çıktı için kayıt yok");
    return;
  }
  const pdfMake = await loadPdfMake();
  const landscape = columns.length > 6;
  const widths = columns.map(() => "*");
  await pdfMake
    .createPdf({
      pageSize: "A4",
      pageOrientation: landscape ? "landscape" : "portrait",
      pageMargins: [28, 32, 28, 36],
      info: { title },
      content: [
        { text: title, fontSize: 14, bold: true, color: "#1e3a5f" },
        {
          text: `${todayIso()}  ·  ${rows.length} kayıt`,
          fontSize: 8,
          color: "#666",
          margin: [0, 4, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths,
            body: [
              columns.map((col) =>
                cell(col.header, { bold: true, fillColor: "#e8eef5", color: "#1e3a5f" })
              ),
              ...rows.map((row) => columns.map((col) => cell(String(row[col.key] ?? "")))),
            ],
          },
          layout: "lightHorizontalLines",
        },
      ],
      defaultStyle: { fontSize: 8 },
    })
    .download(`${safeFileName(title)}.pdf`);
}
