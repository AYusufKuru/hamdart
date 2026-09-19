import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, requireSession } from "@/lib/server/api-utils";
import {
  createBudgetCashEntry,
  listBudgetCashEntries,
  parseBudgetCashRequest,
} from "@/lib/server/budget-cash";
import { budgetCashCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "budget:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await listBudgetCashEntries());
  } catch (e) {
    return jsonCaught(e, "Kasa hareketleri yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBudgetCashRequest(req, budgetCashCreateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(
      await createBudgetCashEntry(parsed.data, auth.session.name, parsed.file),
      201
    );
  } catch (e) {
    return jsonCaught(e, "Kasa hareketi kaydedilemedi");
  }
}
