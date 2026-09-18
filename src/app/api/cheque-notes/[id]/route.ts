import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, parseBody, requireSession } from "@/lib/server/api-utils";
import { deleteChequeNote, updateChequeNote } from "@/lib/server/cheque-notes";
import { chequeNoteUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "invoices:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const parsed = await parseBody(req, chequeNoteUpdateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(await updateChequeNote(id, parsed.data));
  } catch (e) {
    return jsonCaught(e, "Çek / senet güncellenemedi");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "invoices:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteChequeNote(id);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Çek / senet silinemedi");
  }
}
