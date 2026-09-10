import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";

export type AuthUser = {
  userId: string;
  username: string;
  name: string;
  role: Role;
  roleLabel: string;
  mustChangePassword: boolean;
};

export function toAuthUser(session: {
  userId: string;
  username: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}): AuthUser {
  return {
    userId: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
    roleLabel: ROLE_LABELS[session.role],
    mustChangePassword: session.mustChangePassword,
  };
}
