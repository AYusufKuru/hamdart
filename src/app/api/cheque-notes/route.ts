import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, parseBody, requireSession } from "@/lib/server/api-utils";
import {
  createChequeNote,
  listAvailableInstallments,
  listChequeNotes,
} from "@/lib/server/cheque-notes";
import { chequeNoteCreateSchema } from "@/lib/server/schemas";
import type { ChequeDirection, ChequeKind } from "@/data/catalog";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "invoices:read");
  if (!auth.ok) return auth.response;
  try {
    const available = req.nextUrl.searchParams.get("available") === "1";
    if (available) {
      const kindRaw = req.nextUrl.searchParams.get("kind")?.trim() ?? "";
      const directionRaw = req.nextUrl.searchParams.get("direction")?.trim() ?? "";
      const kind: ChequeKind | null = kindRaw === "cek" || kindRaw === "senet" ? kindRaw : null;
      const direction: ChequeDirection | null =
        directionRaw === "received" || directionRaw === "given" ? directionRaw : null;
      return jsonOk(
        await listAvailableInstallments({
          kind,
          direction,
          party: req.nextUrl.searchParams.get("party")?.trim() ?? "",
        })
      );
    }
    return jsonOk(await listChequeNotes());
  } catch (e) {
    return jsonCaught(e, "Çek / senet listesi yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "invoices:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, chequeNoteCreateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(await createChequeNote(parsed.data, auth.session.name), 201);
  } catch (e) {
    return jsonCaught(e, "Çek / senet kaydedilemedi");
  }
}
