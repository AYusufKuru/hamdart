"use client";

import { cn } from "@/lib/utils";
import {
  ROLE_ACCESS_LABELS,
  ROLE_LABELS,
  type Role,
  type RoleAccess,
  type RoleGrant,
} from "@/lib/auth/permissions";

/** Rol seçimi: her rol için işaret kutusu ve Görüntüleme / Değişiklik erişimi */
export function RoleGrantsField({
  value,
  onChange,
  roles,
  disabled,
}: {
  value: RoleGrant[];
  onChange: (next: RoleGrant[]) => void;
  /** Atanabilir roller */
  roles: Role[];
  disabled?: boolean;
}) {
  const byRole = new Map(value.map((g) => [g.role, g.access]));

  function toggle(role: Role) {
    if (byRole.has(role)) {
      onChange(value.filter((g) => g.role !== role));
    } else {
      onChange(
        roles
          .filter((r) => r === role || byRole.has(r))
          .map((r) => ({ role: r, access: byRole.get(r) ?? "edit" }))
      );
    }
  }

  function setAccess(role: Role, access: RoleAccess) {
    onChange(value.map((g) => (g.role === role ? { ...g, access } : g)));
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => {
        const selected = byRole.has(role);
        const access = byRole.get(role) ?? "edit";
        const fixedEdit = role === "SYSTEM_ADMIN";
        return (
          <div
            key={role}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
              selected ? "border-indigo-300 bg-indigo-50/60" : "bg-white"
            )}
          >
            <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(role)}
              />
              <span className="truncate">{ROLE_LABELS[role]}</span>
            </label>
            {selected ? (
              <div className="flex shrink-0 overflow-hidden rounded-lg border text-xs">
                {(["view", "edit"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled || (fixedEdit && option === "view")}
                    onClick={() => setAccess(role, option)}
                    className={cn(
                      "px-2 py-1 transition-colors disabled:opacity-40",
                      access === option
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {ROLE_ACCESS_LABELS[option]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RoleGrantBadges({ grants }: { grants: RoleGrant[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {grants.map((g) => (
        <span
          key={g.role}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
            g.access === "edit"
              ? "border-indigo-200 bg-indigo-50 text-indigo-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          )}
        >
          {ROLE_LABELS[g.role]}
          <span className="opacity-70">· {ROLE_ACCESS_LABELS[g.access]}</span>
        </span>
      ))}
    </div>
  );
}
