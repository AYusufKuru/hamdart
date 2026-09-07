"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Pill, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { csrfHeader } from "@/lib/auth/csrf-client";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    const dest = user.mustChangePassword
      ? "/change-password"
      : searchParams.get("next") || "/dashboard";
    router.replace(dest);
  }, [authLoading, user, router, searchParams]);

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
      const mustChange = Boolean(
        (data as { user?: { mustChangePassword?: boolean } }).user
          ?.mustChangePassword
      );
      const next = searchParams.get("next") || "/dashboard";
      router.push(mustChange ? "/change-password" : next);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50 p-6">
      <Suspense
        fallback={
          <div className="text-muted-foreground">Yükleniyor...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
