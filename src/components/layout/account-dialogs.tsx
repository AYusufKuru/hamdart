"use client";

import { AtSign, Building2, KeyRound, Shield, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangePasswordForm } from "@/app/change-password/change-password-form";
import type { AuthUser } from "@/lib/auth/auth-context";

function initialsFrom(name: string | undefined) {
  if (!name) return "??";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
}) {
  const initials = initialsFrom(user?.name);

  const fields = [
    { icon: UserRound, label: "Ad Soyad", value: user?.name ?? "—" },
    { icon: AtSign, label: "Kullanıcı adı", value: user?.username ?? "—" },
    { icon: Shield, label: "Rol", value: user?.roleLabel ?? "—" },
    { icon: Building2, label: "Tesis", value: "HamdPharma GMP" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 px-6 pb-8 pt-8 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-blue-300/20" />
          <div className="relative flex flex-col items-center text-center">
            <Avatar className="mb-4 h-20 w-20 border-4 border-white/30 shadow-lg shadow-indigo-950/20">
              <AvatarFallback className="bg-white/20 text-lg text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <DialogTitle className="text-xl text-white">
              {user?.name ?? "Profil"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Oturum açmış kullanıcı bilgileri
            </DialogDescription>
            {user?.roleLabel ? (
              <Badge className="mt-2 border-white/20 bg-white/15 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/20">
                {user.roleLabel}
              </Badge>
            ) : null}
          </div>
        </DialogHeader>
        <div className="grid gap-2.5 px-5 py-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="rounded-2xl border bg-muted/25 p-3.5"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <field.icon className="h-3 w-3" />
                {field.label}
              </div>
              <p className="mt-1.5 truncate text-sm font-bold" title={field.value}>
                {field.value}
              </p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 px-6 pb-6 pt-8 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-3 pr-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-white">Şifre Değiştir</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/75">
                {user?.name
                  ? `${user.name} hesabının şifresini güncelleyin.`
                  : "Hesabınızın şifresini güncelleyin."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {open && user ? (
            <ChangePasswordForm
              forced={false}
              username={user.username}
              name={user.name}
              variant="embedded"
              onSuccess={() => onOpenChange(false)}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
