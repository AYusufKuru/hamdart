import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, parseBody, requireSession } from "@/lib/server/api-utils";
import { deleteBudgetCashEntry, updateBudgetCashEntry } from "@/lib/server/budget-cash";
import { budgetCashUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const parsed = await parseBody(req, budgetCashUpdateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(await updateBudgetCashEntry(id, parsed.data));
  } catch (e) {
    return jsonCaught(e, "Kasa hareketi güncellenemedi");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteBudgetCashEntry(id);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Kasa hareketi silinemedi");
  }
}
