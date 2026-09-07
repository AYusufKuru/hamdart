"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type UserRow,
} from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { PASSWORD_RULES_TEXT } from "@/lib/auth/password-rules";
import { formatDate } from "@/lib/utils";
import { KeyRound, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  username: "",
  name: "",
  role: "VIEWER" as Role,
  password: "",
};

export function UsersPanel() {
  const { user: currentUser, canWrite } = useAuth();
  const canManage = canWrite("admin");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser(form);
      toast.success(
        `${form.username} oluşturuldu. Kullanıcı ilk girişte şifresini değiştirecek.`
      );
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kullanıcı oluşturulamadı");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(u: UserRow, role: Role) {
    try {
      await updateUser(u.id, { role });
      toast.success(`${u.username} rolü ${ROLE_LABELS[role]} olarak güncellendi`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rol güncellenemedi");
      await refresh();
    }
  }

  async function handleToggleActive(u: UserRow) {
    try {
      await updateUser(u.id, { active: !u.active });
      toast.success(
        u.active
          ? `${u.username} hesabı kapatıldı`
          : `${u.username} hesabı açıldı`
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  }

  async function handleResetPassword(u: UserRow) {
    const password = window.prompt(
      `${u.username} için yeni şifre belirleyin.\n\n${PASSWORD_RULES_TEXT}\n\nKullanıcı ilk girişte bu şifreyi değiştirmek zorunda kalacak.`
    );
    if (!password) return;
    try {
      await updateUser(u.id, { password });
      toast.success(`${u.username} şifresi sıfırlandı`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre sıfırlanamadı");
    }
  }

  async function handleDelete(u: UserRow) {
    if (
      !window.confirm(
        `${u.username} kullanıcısı kalıcı olarak silinsin mi?\n\nHesabı silmek yerine kapatmayı düşünün — denetim kayıtlarındaki geçmişi korumak için kapatmak daha uygundur.`
      )
    ) {
      return;
    }
    try {
      await deleteUser(u.id);
      toast.success(`${u.username} silindi`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Yeni Kullanıcı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 lg:items-end"
            >
              <div className="space-y-2">
                <Label htmlFor="new-username">Kullanıcı adı</Label>
                <Input
                  id="new-username"
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  placeholder="ahmet.yilmaz"
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Ad soyad</Label>
                <Input
                  id="new-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ahmet Yılmaz"
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">Rol</Label>
                <Select
                  value={form.role}
                  onValueChange={(role) =>
                    setForm((f) => ({ ...f, role: role as Role }))
                  }
                >
                  <SelectTrigger id="new-role" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Geçici şifre</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="rounded-xl"
                  required
                />
              </div>
              <Button
                type="submit"
                className="rounded-xl"
                disabled={saving}
              >
                {saving ? "Ekleniyor..." : "Kullanıcı Ekle"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              {PASSWORD_RULES_TEXT} Kullanıcı ilk girişinde bu şifreyi
              değiştirmek zorunda kalacak.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Kullanıcılar
            <Badge variant="secondary">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Yükleniyor...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı adı</TableHead>
                  <TableHead>Ad soyad</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Oluşturma</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.userId;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.username}
                        {isSelf && (
                          <Badge variant="info" className="ml-2">
                            siz
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        {canManage && !isSelf ? (
                          <Select
                            value={u.role}
                            onValueChange={(role) =>
                              void handleRoleChange(u, role as Role)
                            }
                          >
                            <SelectTrigger className="rounded-lg h-8 w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{ROLE_LABELS[u.role]}</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <Badge variant={u.active ? "success" : "secondary"}>
                          {u.active ? "Aktif" : "Kapalı"}
                        </Badge>
                        {u.mustChangePassword && (
                          <Badge variant="danger">Şifre bekliyor</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(u.createdAt.slice(0, 10))}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {canManage && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => void handleResetPassword(u)}
                            >
                              <KeyRound className="w-3 h-3 mr-1" />
                              Şifre
                            </Button>
                            {!isSelf && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => void handleToggleActive(u)}
                                >
                                  {u.active ? "Kapat" : "Aç"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-lg text-destructive"
                                  onClick={() => void handleDelete(u)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      Kullanıcı bulunamadı
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
