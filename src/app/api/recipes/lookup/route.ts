import type { NextRequest } from "next/server";
import { jsonCaught, jsonError, jsonOk, requireSession } from "@/lib/server/api-utils";
import { dbGetRecipeByOrderId, dbGetRecipeForOrder } from "@/lib/server/data-service";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "recipes:read");
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const product = url.searchParams.get("product");
    const recipeNo = url.searchParams.get("recipeNo") ?? undefined;

    if (orderId && product) {
      const recipe = await dbGetRecipeForOrder({ id: orderId, product, recipeNo });
      return jsonOk(recipe ?? null);
    }
    if (orderId) {
      const recipe = await dbGetRecipeByOrderId(orderId);
      return jsonOk(recipe ?? null);
    }
    return jsonError("orderId gerekli", 400);
  } catch (e) {
    return jsonCaught(e, "Reçete aranamadı");
  }
}
