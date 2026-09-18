import type { NextRequest } from "next/server";
import { jsonCaught, jsonError, requireSession } from "@/lib/server/api-utils";
import { getInvoiceEventByFileId, readInvoiceDocFile } from "@/lib/server/invoice-events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const auth = await requireSession(req, "invoices:read");
  if (!auth.ok) return auth.response;
  try {
    const { fileId } = await params;
    const event = await getInvoiceEventByFileId(fileId);
    const buf = await readInvoiceDocFile(fileId);
    const mime = event?.mimeType || guessMime(fileId);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(event?.fileName || fileId)}"`,
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
