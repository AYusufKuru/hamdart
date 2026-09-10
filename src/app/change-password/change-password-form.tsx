"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { getFirstAllowedPath } from "@/lib/auth/permissions";
import {
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "@/lib/auth/password-rules";
import { csrfHeader } from "@/lib/auth/csrf-client";
import { toast } from "sonner";

/**
 * @param forced Oturum sunucuda okunarak belirlenir; böylece başlık
 *               hidrasyondan önce doğru görünür.
 */
export function ChangePasswordForm({
  forced,
  username,
  name,
  variant = "page",
  onSuccess,
}: {
  forced: boolean;
  username: string;
  name: string;
  variant?: "page" | "embedded";
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { refresh, logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Sunucuya gitmeden anında geri bildirim; sunucu yine de kendi kontrolünü yapar
  const localProblem =
    newPassword.length > 0
      ? validatePassword(newPassword, { username, name })
      : null;
  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mismatch) {
      toast.error("Yeni şifre ile tekrarı aynı değil");
      return;
    }
    if (localProblem) {
      toast.error(localProblem);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeader() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Şifre değiştirilemedi"
        );
      }
      toast.success("Şifreniz değiştirildi");
      await refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(user ? getFirstAllowedPath(user.role) : "/dashboard");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${variant}-currentPassword`}>Mevcut şifre</Label>
        <Input
          id={`${variant}-currentPassword`}
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="rounded-xl"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${variant}-newPassword`}>Yeni şifre</Label>
        <Input
          id={`${variant}-newPassword`}
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="rounded-xl"
          required
        />
        <p
          className={
            localProblem
              ? "text-xs text-destructive flex items-start gap-1.5"
              : "text-xs text-muted-foreground flex items-start gap-1.5"
          }
        >
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {localProblem ?? PASSWORD_RULES_TEXT}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${variant}-confirmPassword`}>Yeni şifre (tekrar)</Label>
        <Input
          id={`${variant}-confirmPassword`}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-xl"
          required
        />
        {mismatch && (
          <p className="text-xs text-destructive">Şifre tekrarı eşleşmiyor.</p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full rounded-xl"
        disabled={loading || !!localProblem || mismatch}
      >
        {loading ? "Kaydediliyor..." : "Şifreyi Değiştir"}
      </Button>
      {forced && variant === "page" && (
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-xl text-muted-foreground"
          onClick={() => void logout()}
        >
          Çıkış yap
        </Button>
      )}
    </form>
  );

  if (variant === "embedded") {
    return form;
  }

  return (
    <Card className="w-full max-w-md glass-card border-none shadow-xl">
      <CardHeader className="text-center space-y-4 pb-2">
        <div className="mx-auto w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <KeyRound className="text-white w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {forced ? "Şifrenizi Belirleyin" : "Şifre Değiştir"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {forced
              ? "Devam etmek için kurulum şifresini kendi şifrenizle değiştirmeniz gerekiyor."
              : `${name} hesabının şifresini güncelleyin.`}
          </p>
        </div>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
