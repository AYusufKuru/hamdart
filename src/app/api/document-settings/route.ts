import type { NextRequest } from "next/server";
import {
  jsonCaught,
  jsonOk,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  getDocumentSettings,
  saveDocumentSettings,
} from "@/lib/server/document-settings";
import { documentSettingsUpdateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "invoices:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await getDocumentSettings());
  } catch (e) {
    console.error("PDF ayarları yüklenemedi:", e);
    return jsonCaught(e, "PDF ayarları yüklenemedi");
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, "invoices:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, documentSettingsUpdateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(await saveDocumentSettings(parsed.data));
  } catch (e) {
    return jsonCaught(e, "PDF ayarları kaydedilemedi");
  }
}
