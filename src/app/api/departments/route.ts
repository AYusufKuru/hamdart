import type { NextRequest } from "next/server";
import {
  createDepartment,
  listDepartments,
} from "@/lib/server/departments";
import {
  formatApiError,
  getIpFromRequest,
  jsonCaught,
  jsonError,
  jsonOk,
  parseBody,
  requireAdmin,
  requireSession,
} from "@/lib/server/api-utils";
import { departmentCreateSchema } from "@/lib/server/schemas";

export async function GET(req: NextRequest) {
  const auth = await requireSession(req, "dashboard:read");
  if (!auth.ok) return auth.response;

  try {
    return jsonOk(await listDepartments());
  } catch (e) {
    console.error("Departmanlar yüklenemedi:", e);
    return jsonError(formatApiError(e, "Departmanlar yüklenemedi"), 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const parsed = await parseBody(req, departmentCreateSchema);
    if (!parsed.ok) return parsed.response;
    const row = await createDepartment(parsed.data.name, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(row, 201);
  } catch (e) {
    return jsonCaught(e, "Departman eklenemedi");
  }
}
