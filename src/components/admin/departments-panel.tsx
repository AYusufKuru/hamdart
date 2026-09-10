"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createDepartment,
  deleteDepartment,
  fetchDepartments,
  updateDepartment,
  type DepartmentRow,
} from "@/lib/catalog-store";
import { formatDate } from "@/lib/utils";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DepartmentsPanel() {
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchDepartments());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Departmanlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Departman adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      await createDepartment(name.trim());
      toast.success("Departman eklendi");
      setName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) {
      toast.error("Departman adı zorunludur");
      return;
    }
    try {
      await updateDepartment(id, editingName.trim());
      toast.success("Departman güncellendi");
      setEditingId(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Güncellenemedi");
    }
  }

  async function handleDelete(row: DepartmentRow) {
    if (!window.confirm(`${row.name} silinsin mi?`)) return;
    try {
      await deleteDepartment(row.id);
      toast.success("Departman silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-base">Yeni departman</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-[16rem] flex-1 space-y-1.5">
              <label
                htmlFor="dept-name"
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
              >
                Ad
              </label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Kalite Güvence"
                className="rounded-xl"
                required
              />
            </div>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              <Plus className="w-4 h-4 mr-2" />
              {saving ? "Ekleniyor…" : "Departman Ekle"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Personel ve bütçe formlarındaki birim listesi buradan gelir. Ad
            değişince mevcut kayıtlardaki birim adı da güncellenir.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Departmanlar
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Yükleniyor...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Oluşturma</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const editing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {editing ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="rounded-lg h-8 max-w-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleSaveEdit(row.id);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(row.createdAt.slice(0, 10))}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {editing ? (
                          <>
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => void handleSaveEdit(row.id)}
                            >
                              Kaydet
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => setEditingId(null)}
                            >
                              Vazgeç
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditingName(row.name);
                              }}
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-lg text-destructive"
                              onClick={() => void handleDelete(row)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground py-8"
                    >
                      Henüz departman yok — yukarıdan ekleyin
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
