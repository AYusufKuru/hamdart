import type { NextRequest } from "next/server";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  NO_STORE_HEADERS,
  parseBody,
  requireSession,
} from "@/lib/server/api-utils";
import {
  dbCreateRecipe,
  dbGetAllRecipes,
  dbNextRecipeCode,
  dbUpdateRecipe,
} from "@/lib/server/data-service";
import { recipeCreateSchema, recipeUpdateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "recipes:read");
  if (!auth.ok) return auth.response;
  try {
    return jsonOk(await dbGetAllRecipes());
  } catch (e) {
    return jsonCaught(e, "Reçeteler yüklenemedi");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(req, "recipes:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, recipeCreateSchema);
    if (!parsed.ok) return parsed.response;
    const recipe = await dbCreateRecipe(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(recipe, 201);
  } catch (e) {
    return jsonCaught(e);
  }
}

export async function HEAD(req: NextRequest) {
  const auth = await requireSession(req, "recipes:read");
  if (!auth.ok) return auth.response;
  try {
    const code = await dbNextRecipeCode();
    return new Response(null, {
      headers: { "X-Next-Code": code, ...NO_STORE_HEADERS },
    });
  } catch (e) {
    return jsonCaught(e, "Reçete kodu alınamadı");
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(req, "recipes:write");
  if (!auth.ok) return auth.response;
  try {
    const parsed = await parseBody(req, recipeUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const recipe = await dbUpdateRecipe(parsed.data, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(recipe);
  } catch (e) {
    return jsonCaught(e);
  }
}
