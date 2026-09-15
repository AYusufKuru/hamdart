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
  FormDialog,
  FormField,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type UserRow,
} from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import {
  ROLES,
  ROLE_LABELS,
  assignableRoles,
  canManageUser,
  type Role,
} from "@/lib/auth/permissions";
import {
  PASSWORD_RULES_TEXT,
  validatePassword,
} from "@/lib/auth/password-rules";
import { capitalizeWordsTr, formatDate } from "@/lib/utils";
import { KeyRound, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  username: "",
  name: "",
  role: "STOCK" as Role,
  password: "",
};

export function UsersPanel() {
  const { user: currentUser, canWrite } = useAuth();
  const canManage = canWrite("users");
  const roles = currentUser ? assignableRoles(currentUser.role) : [];

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!currentUser || !roles.includes(form.role)) {
      toast.error("Bu rolü atama yetkiniz yok");
      return;
    }
    setSaving(true);
    try {
      await createUser({
        ...form,
        name: capitalizeWordsTr(form.name),
      });
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
    if (
      !currentUser ||
      u.id === currentUser.userId ||
      !canManageUser(currentUser.role, u.role) ||
      !roles.includes(role)
    ) {
      toast.error("Bu kullanıcı üzerinde işlem yapamazsınız");
      return;
    }
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
    if (
      !currentUser ||
      u.id === currentUser.userId ||
      !canManageUser(currentUser.role, u.role)
    ) {
      toast.error("Bu kullanıcı üzerinde işlem yapamazsınız");
      return;
    }
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

  function openEditDialog(u: UserRow) {
    if (!currentUser || !canManageUser(currentUser.role, u.role)) {
      toast.error("Bu kullanıcıyı düzenleyemezsiniz");
      return;
    }
    setEditTarget(u);
    setEditName(u.name);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    if (!currentUser || !canManageUser(currentUser.role, editTarget.role)) {
      toast.error("Bu kullanıcıyı düzenleyemezsiniz");
      return;
    }
    setEditSaving(true);
    try {
      await updateUser(editTarget.id, { name: capitalizeWordsTr(editName) });
      toast.success(`${editTarget.username} güncellendi`);
      setEditTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    } finally {
      setEditSaving(false);
    }
  }

  function openPasswordDialog(u: UserRow) {
    if (!currentUser || !canManageUser(currentUser.role, u.role)) {
      toast.error("Bu kullanıcının şifresini değiştiremezsiniz");
      return;
    }
    setPasswordTarget(u);
    setNewPassword("");
    setNewPasswordAgain("");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTarget) return;
    const problem = validatePassword(newPassword, {
      username: passwordTarget.username,
      name: passwordTarget.name,
    });
    if (problem) {
      toast.error(problem);
      return;
    }
    if (newPassword !== newPasswordAgain) {
      toast.error("Şifre tekrarı eşleşmiyor");
      return;
    }
    if (
      !currentUser ||
      !canManageUser(currentUser.role, passwordTarget.role)
    ) {
      toast.error("Bu kullanıcının şifresini değiştiremezsiniz");
      return;
    }
    setPasswordSaving(true);
    try {
      await updateUser(passwordTarget.id, { password: newPassword });
      toast.success(
        `${passwordTarget.username} şifresi sıfırlandı. Kullanıcı ilk girişte yeni şifre belirleyecek.`
      );
      setPasswordTarget(null);
      setNewPassword("");
      setNewPasswordAgain("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre sıfırlanamadı");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (
      !currentUser ||
      deleteTarget.id === currentUser.userId ||
      !canManageUser(currentUser.role, deleteTarget.role)
    ) {
      toast.error("Bu kullanıcı üzerinde işlem yapamazsınız");
      return;
    }
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.username} silindi`);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    } finally {
      setDeleting(false);
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
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(10rem,0.9fr)_minmax(0,1fr)_auto]">
                <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
                  <Label htmlFor="new-username" className="self-end truncate">
                    Kullanıcı adı
                  </Label>
                  <Input
                    id="new-username"
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="ahmet.yilmaz"
                    className="h-10 rounded-xl"
                    required
                  />
                </div>
                <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
                  <Label htmlFor="new-name" className="self-end truncate">
                    Ad soyad
                  </Label>
                  <Input
                    id="new-name"
                    value={form.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      const trailing = /\s+$/.test(value);
                      const name = capitalizeWordsTr(value);
                      setForm((f) => ({
                        ...f,
                        name: trailing && name ? `${name} ` : name,
                      }));
                    }}
                    placeholder="Ahmet Yılmaz"
                    className="h-10 rounded-xl"
                    required
                  />
                </div>
                <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
                  <Label htmlFor="new-role" className="self-end truncate">
                    Rol
                  </Label>
                  <Select
                    value={form.role}
                    onValueChange={(role) =>
                      setForm((f) => ({ ...f, role: role as Role }))
                    }
                  >
                    <SelectTrigger id="new-role" className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
                  <Label htmlFor="new-password" className="self-end truncate">
                    Geçici şifre
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="h-10 rounded-xl"
                    required
                  />
                </div>
                <div className="grid grid-rows-[1.25rem_2.5rem] gap-2">
                  <span className="hidden xl:block" aria-hidden />
                  <Button
                    type="submit"
                    className="h-10 rounded-xl"
                    disabled={saving}
                  >
                    {saving ? "Ekleniyor..." : "Kullanıcı Ekle"}
                  </Button>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {PASSWORD_RULES_TEXT} Kullanıcı ilk girişinde bu şifreyi
                değiştirmek zorunda kalacak.
              </p>
            </form>
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
                  <TableHead sortable={false}>İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.userId;
                  const roleKnown = ROLES.includes(u.role);
                  const canActOnUser = Boolean(
                    currentUser && canManageUser(currentUser.role, u.role)
                  );
                  const canEditRole = canManage && canActOnUser && !isSelf;
                  const canEditUser = canManage && canActOnUser;
                  const canDisableOrDelete =
                    canManage && canActOnUser && !isSelf;
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
                        {canEditRole ? (
                          <Select
                            value={roleKnown ? u.role : undefined}
                            onValueChange={(role) =>
                              void handleRoleChange(u, role as Role)
                            }
                          >
                            <SelectTrigger className="rounded-lg h-8 w-44">
                              <SelectValue
                                placeholder={ROLE_LABELS[u.role] ?? u.role}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
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
                      <TableCell className="max-w-none overflow-visible text-right whitespace-nowrap">
                        {canEditUser || canDisableOrDelete ? (
                          <div className="flex justify-end gap-2">
                            {canEditUser ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => openEditDialog(u)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Düzenle
                              </Button>
                            ) : null}
                            {canEditUser ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => openPasswordDialog(u)}
                              >
                                <KeyRound className="w-3 h-3 mr-1" />
                                Şifre
                              </Button>
                            ) : null}
                            {canDisableOrDelete ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => void handleToggleActive(u)}
                                >
                                  {u.active ? "Kapat" : "Aç"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-lg text-destructive"
                                  onClick={() => setDeleteTarget(u)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : null}
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

      <FormDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open && !editSaving) setEditTarget(null);
        }}
        icon={Pencil}
        title="Kullanıcıyı düzenle"
        description={
          editTarget
            ? `${editTarget.username} için görünen adı güncelleyin. Kullanıcı adı giriş içindir, değişmez.`
            : undefined
        }
      >
        <form onSubmit={(e) => void handleEdit(e)}>
          <FormSheetBody>
            <FormField label="Kullanıcı adı">
              <Input
                value={editTarget?.username ?? ""}
                className="rounded-xl"
                disabled
              />
            </FormField>
            <FormField label="Ad soyad" htmlFor="edit-user-name" required>
              <Input
                id="edit-user-name"
                value={editName}
                onChange={(e) => {
                  const value = e.target.value;
                  const trailing = /\s+$/.test(value);
                  const name = capitalizeWordsTr(value);
                  setEditName(trailing && name ? `${name} ` : name);
                }}
                className="rounded-xl"
                required
              />
            </FormField>
          </FormSheetBody>
          <FormSheetFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={editSaving}
              onClick={() => setEditTarget(null)}
            >
              Vazgeç
            </Button>
            <Button type="submit" className="rounded-xl" disabled={editSaving}>
              {editSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </FormSheetFooter>
        </form>
      </FormDialog>

      <FormDialog
        open={Boolean(passwordTarget)}
        onOpenChange={(open) => {
          if (!open && !passwordSaving) {
            setPasswordTarget(null);
            setNewPassword("");
            setNewPasswordAgain("");
          }
        }}
        icon={KeyRound}
        title="Şifre sıfırla"
        description={
          passwordTarget
            ? `${passwordTarget.username} için geçici şifre belirleyin. Kullanıcı ilk girişte bunu değiştirmek zorunda kalacak.`
            : undefined
        }
      >
        <form onSubmit={(e) => void handleResetPassword(e)}>
          <FormSheetBody>
            <FormField label="Yeni şifre" htmlFor="reset-password" required>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
                required
              />
            </FormField>
            <FormField
              label="Şifre tekrarı"
              htmlFor="reset-password-again"
              required
            >
              <Input
                id="reset-password-again"
                type="password"
                autoComplete="new-password"
                value={newPasswordAgain}
                onChange={(e) => setNewPasswordAgain(e.target.value)}
                className="rounded-xl"
                required
              />
            </FormField>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {PASSWORD_RULES_TEXT}
            </p>
          </FormSheetBody>
          <FormSheetFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={passwordSaving}
              onClick={() => setPasswordTarget(null)}
            >
              Vazgeç
            </Button>
            <Button type="submit" className="rounded-xl" disabled={passwordSaving}>
              {passwordSaving ? "Kaydediliyor..." : "Şifreyi sıfırla"}
            </Button>
          </FormSheetFooter>
        </form>
      </FormDialog>

      <FormDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        icon={Trash2}
        title="Kullanıcıyı sil"
        description={
          deleteTarget
            ? `${deleteTarget.username} kalıcı olarak silinsin mi? Denetim geçmişini korumak için hesabı kapatmak daha uygundur.`
            : undefined
        }
      >
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={deleting}
            onClick={() => setDeleteTarget(null)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? "Siliniyor..." : "Sil"}
          </Button>
        </FormSheetFooter>
      </FormDialog>
    </div>
  );
}
