import type { NextRequest } from "next/server";
import {
  deleteDepartment,
  updateDepartment,
} from "@/lib/server/departments";
import {
  getIpFromRequest,
  jsonCaught,
  jsonOk,
  parseBody,
  requireAdmin,
} from "@/lib/server/api-utils";
import { departmentUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const parsed = await parseBody(req, departmentUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const row = await updateDepartment(id, parsed.data.name, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk(row);
  } catch (e) {
    return jsonCaught(e, "Departman güncellenemedi");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await deleteDepartment(id, {
      actor: auth.session.name,
      ip: getIpFromRequest(req),
    });
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonCaught(e, "Departman silinemedi");
  }
}
