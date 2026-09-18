import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, requireSession } from "@/lib/server/api-utils";
import { deleteBudgetCategory } from "@/lib/server/budget-categories";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await deleteBudgetCategory(id);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Çeşit silinemedi");
  }
}
