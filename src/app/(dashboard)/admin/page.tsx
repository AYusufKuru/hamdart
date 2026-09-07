"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  createBackup,
  deleteBackup,
  fetchAuditLogs,
  fetchBackups,
  restoreBackup,
  type AuditLogRow,
  type BackupInfo,
} from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { UsersPanel } from "@/components/admin/users-panel";
import {
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { formatDate, formatNumber } from "@/lib/utils";
import { Database, History, RotateCcw, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

function actionVariant(action: string) {
  if (action === "DELETE" || action === "RESTORE") return "danger" as const;
  if (action === "BACKUP") return "info" as const;
  if (action === "CREATE") return "success" as const;
  return "secondary" as const;
}

function AdminContent() {
  const { user, canWrite } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupNote, setBackupNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null);
  const [confirmFilename, setConfirmFilename] = useState("");
  const [restoring, setRestoring] = useState(false);
  const canManage = canWrite("admin");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, list] = await Promise.all([
        fetchAuditLogs(200),
        fetchBackups(),
      ]);
      setAuditLogs(logs);
      setBackups(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleBackup() {
    try {
      await createBackup(backupNote || undefined);
      setBackupNote("");
      toast.success("Yedek oluşturuldu");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yedek alınamadı");
    }
  }

  function openRestore(row: BackupInfo) {
    setRestoreTarget(row);
    setConfirmFilename("");
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    if (confirmFilename.trim() !== restoreTarget.filename) {
      toast.error("Dosya adını tam olarak yazın");
      return;
    }
    setRestoring(true);
    try {
      await restoreBackup(restoreTarget.id, confirmFilename.trim());
      setRestoreTarget(null);
      setConfirmFilename("");
      toast.success("Veritabanı geri yüklendi");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Geri yükleme başarısız");
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu yedek dosyası silinsin mi?")) return;
    try {
      await deleteBackup(id);
      toast.success("Yedek silindi");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi");
    }
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Sistem"
        title="Denetim & Yedekleme"
        description="Tüm veri değişiklikleri kayıt altında. Düzenli yedek alın."
      />

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Oturum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Denetim kayıtları <strong>{user?.name ?? "—"}</strong> (
            {user?.roleLabel ?? "—"}) adına yazılır.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="audit">
        <TabsList className="rounded-xl">
          <TabsTrigger value="audit" className="rounded-lg gap-2">
            <History className="w-4 h-4" />
            Denetim Kaydı
          </TabsTrigger>
          <TabsTrigger value="backups" className="rounded-lg gap-2">
            <Database className="w-4 h-4" />
            Yedekler
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-lg gap-2">
            <Users className="w-4 h-4" />
            Kullanıcılar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-6">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              {loading ? (
                <p className="p-6 text-muted-foreground">Yükleniyor...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>İşlem</TableHead>
                      <TableHead>Varlık</TableHead>
                      <TableHead>Özet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("tr-TR")}
                        </TableCell>
                        <TableCell>{log.actor}</TableCell>
                        <TableCell>
                          <Badge variant={actionVariant(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.entityType}
                          {log.entityId ? ` · ${log.entityId.slice(0, 12)}` : ""}
                        </TableCell>
                        <TableCell className="max-w-md truncate text-sm">
                          {log.summary}
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Henüz kayıt yok
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Geri yüklemek için dump dosya adını aynı şekilde yazmanız gerekir.
            Yüklemeden önce mevcut verinin güvenlik kopyası otomatik alınır.
          </p>
          {canManage && (
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-base">Yeni Yedek Al</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Input
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                placeholder="Not (isteğe bağlı)"
                className="rounded-xl max-w-sm"
              />
              <Button className="rounded-xl" onClick={() => void handleBackup()}>
                <Database className="w-4 h-4 mr-2" />
                Yedek Oluştur
              </Button>
            </CardContent>
          </Card>
          )}

          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dosya</TableHead>
                    <TableHead>Boyut</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Oluşturan</TableHead>
                    <TableHead>Not</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                      <TableCell>{formatNumber(Math.round(b.sizeBytes / 1024))} KB</TableCell>
                      <TableCell>{formatDate(b.createdAt.slice(0, 10))}</TableCell>
                      <TableCell>{b.createdBy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {canManage && (
                          <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => openRestore(b)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Geri Yükle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-lg text-destructive"
                          onClick={() => void handleDelete(b.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {backups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Henüz yedek yok — ilk yedeği oluşturun
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UsersPanel />
        </TabsContent>
      </Tabs>

      <FormSheet
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open && !restoring) {
            setRestoreTarget(null);
            setConfirmFilename("");
          }
        }}
        title="Veritabanını geri yükle"
        description="Bu işlem mevcut verinin üzerine yazar. İptal edilemez."
      >
        <FormSheetBody>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Geri yüklemeden hemen önce otomatik bir güvenlik yedeği alınır.
            Onaylamak için aşağıdaki dosya adını <strong>aynı şekilde</strong> yazın.
          </p>
          <p className="font-mono text-xs break-all rounded-lg bg-muted px-3 py-2">
            {restoreTarget?.filename}
          </p>
          <FormField
            label="Dosya adı"
            htmlFor="confirm-backup-filename"
            hint="Adı tam olarak eşleşmeden onay düğmesi açılmaz."
          >
            <Input
              id="confirm-backup-filename"
              value={confirmFilename}
              onChange={(e) => setConfirmFilename(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="rounded-xl font-mono text-xs"
              placeholder="hamdart-….dump"
            />
          </FormField>
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={restoring}
            onClick={() => {
              setRestoreTarget(null);
              setConfirmFilename("");
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl"
            disabled={
              restoring ||
              !restoreTarget ||
              confirmFilename.trim() !== restoreTarget.filename
            }
            onClick={() => void handleRestore()}
          >
            {restoring ? "Yükleniyor…" : "Geri yükle"}
          </Button>
        </FormSheetFooter>
      </FormSheet>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <AdminContent />
    </Suspense>
  );
}
