import type { NextRequest } from "next/server";
import { jsonCaught, jsonOk, parseBody, requireSession } from "@/lib/server/api-utils";
import { createBudgetCategory, listBudgetCategories } from "@/lib/server/budget-categories";
import { budgetCategoryCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "budget:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await listBudgetCategories());
  } catch (e) {
    return jsonCaught(e, "Çeşitler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "budget:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, budgetCategoryCreateSchema);
    if (!parsed.ok) return parsed.response;
    return jsonOk(await createBudgetCategory(parsed.data), 201);
  } catch (e) {
    return jsonCaught(e, "Çeşit eklenemedi");
  }
}
