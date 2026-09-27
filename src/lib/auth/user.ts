import { grantsLabel, type Role, type RoleGrant } from "@/lib/auth/permissions";

export type AuthUser = {
  userId: string;
  username: string;
  name: string;
  role: Role;
  grants: RoleGrant[];
  roleLabel: string;
  mustChangePassword: boolean;
};

export function toAuthUser(session: {
  userId: string;
  username: string;
  name: string;
  role: Role;
  grants: RoleGrant[];
  mustChangePassword: boolean;
}): AuthUser {
  return {
    userId: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
    grants: session.grants,
    roleLabel: grantsLabel(session.grants),
    mustChangePassword: session.mustChangePassword,
  };
}
