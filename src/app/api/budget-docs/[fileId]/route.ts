import type { NextRequest } from "next/server";
import { jsonCaught, jsonError, requireSession } from "@/lib/server/api-utils";
import { getBudgetCashEntryByFileId } from "@/lib/server/budget-cash";
import { readInvoiceDocFile } from "@/lib/server/invoice-events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireSession(req, "budget:read");
  if (!auth.ok) return auth.response;
  try {
    const { fileId } = await params;
    const entry = await getBudgetCashEntryByFileId(fileId);
    if (!entry) return jsonError("Dosya bulunamadı", 404);
    const buf = await readInvoiceDocFile(fileId);
    const mime = entry.mimeType || guessMime(fileId);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(entry.fileName || fileId)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Geçersiz")) {
      return jsonError(e.message, 400);
    }
    return jsonCaught(e, "Dosya bulunamadı");
  }
}

function guessMime(fileId: string) {
  if (fileId.endsWith(".pdf")) return "application/pdf";
  if (fileId.endsWith(".png")) return "image/png";
  if (fileId.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
