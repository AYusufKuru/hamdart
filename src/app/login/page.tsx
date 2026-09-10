"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROLE_LABELS, useAuth, type AuthUser } from "@/lib/auth/auth-context";
import { getFirstAllowedPath } from "@/lib/auth/permissions";
import { csrfHeader } from "@/lib/auth/csrf-client";
import { toast } from "sonner";

function nextPathFromLocation(role?: AuthUser["role"]): string {
  const fallback = role ? getFirstAllowedPath(role) : "/dashboard";
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  if (next === "/" || next === "/dashboard") return fallback;
  return next && next.startsWith("/") ? next : fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, hydrateUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const dest = user.mustChangePassword
      ? "/change-password"
      : nextPathFromLocation(user.role);
    router.replace(dest);
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...csrfHeader() },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Giriş başarısız"
        );
      }
      toast.success("Giriş başarılı");
      const payload = data as {
        user?: {
          id: string;
          username: string;
          name: string;
          role: AuthUser["role"];
          mustChangePassword?: boolean;
        };
      };
      if (payload.user) {
        hydrateUser({
          userId: payload.user.id,
          username: payload.user.username,
          name: payload.user.name,
          role: payload.user.role,
          roleLabel: ROLE_LABELS[payload.user.role],
          mustChangePassword: Boolean(payload.user.mustChangePassword),
        });
      }
      const mustChange = Boolean(payload.user?.mustChangePassword);
      router.push(mustChange ? "/change-password" : nextPathFromLocation(payload.user?.role));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50 p-6">
      <Card className="w-full max-w-md glass-card border-none shadow-xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Pill className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">HamdPharma</h1>
            <p className="text-sm text-muted-foreground mt-1">
              İlaç Üretim Yönetim Sistemi
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı adı</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={loading}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
