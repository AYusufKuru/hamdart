import type { NextRequest } from "next/server";
import {
  jsonCaught,
  jsonOk,
  requireSession,
} from "@/lib/server/api-utils";
import {
  addInvoicePaymentEvent,
  addInvoiceStatusEvent,
  INVOICE_DOC_MAX_BYTES,
  listAllInvoiceEvents,
  listInvoiceEvents,
} from "@/lib/server/invoice-events";
import { INVOICE_STATUSES } from "@/lib/invoice-docs";
import { FieldError } from "@/lib/server/fields";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "invoices:read");
  if (!auth.ok) return auth.response;
  const invoiceNo = req.nextUrl.searchParams.get("invoiceNo")?.trim() ?? "";
  try {
    if (!invoiceNo) return jsonOk(await listAllInvoiceEvents());
    return jsonOk(await listInvoiceEvents(invoiceNo));
  } catch (e) {
    return jsonCaught(e, "Hareketler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "invoices:write");
  if (!auth.ok) return auth.response;
  try {
    const form = await req.formData();
    const invoiceNo = String(form.get("invoiceNo") ?? "").trim();
    const kind = String(form.get("kind") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const filePart = form.get("file");
    let file: { buffer: Buffer; mimeType: string; originalName: string } | undefined;
    if (filePart instanceof File && filePart.size > 0) {
      if (filePart.size > INVOICE_DOC_MAX_BYTES) {
        throw new FieldError("Dosya 5 MB altında olmalıdır");
      }
      file = {
        buffer: Buffer.from(await filePart.arrayBuffer()),
        mimeType: filePart.type || "application/octet-stream",
        originalName: filePart.name || "ek",
      };
    }
    const ctx = auth.session.name;
    if (kind === "payment") {
      const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
      const method = String(form.get("method") ?? "").trim();
      const installmentRaw = String(form.get("installmentIds") ?? "").trim();
      let installmentIds: string[] = [];
      if (installmentRaw) {
        try {
          const parsed = JSON.parse(installmentRaw) as unknown;
          if (Array.isArray(parsed)) {
            installmentIds = parsed.map((id) => String(id));
          }
        } catch {
          throw new FieldError("Çek / senet seçimi geçersiz");
        }
      }
      return jsonOk(
        await addInvoicePaymentEvent({
          invoiceNo,
          amount: Number.isFinite(amount) ? amount : 0,
          method,
          note,
          createdBy: ctx,
          file,
          installmentIds,
        }),
        201
      );
    }
    const status = String(form.get("status") ?? "").trim();
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) {
      throw new FieldError("Geçersiz durum");
    }
    return jsonOk(
      await addInvoiceStatusEvent({
        invoiceNo,
        status,
        note,
        createdBy: ctx,
        file,
      }),
      201
    );
  } catch (e) {
    return jsonCaught(e, "Kayıt eklenemedi");
  }
}
