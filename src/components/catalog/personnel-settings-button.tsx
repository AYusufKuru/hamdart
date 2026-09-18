"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import {
  createDepartment,
  createJobTitle,
  deleteDepartment,
  deleteJobTitle,
  fetchDepartments,
  fetchJobTitles,
  type DepartmentRow,
  type JobTitleRow,
} from "@/lib/catalog-store";

function CatalogColumn({
  title,
  description,
  placeholder,
  rows,
  writable,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  placeholder: string;
  rows: Array<{ id: string; name: string }>;
  writable: boolean;
  onAdd: (name: string) => Promise<void>;
  onRemove: (row: { id: string; name: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const value = name.trim();
    if (!value) {
      toast.error("Ad girin");
      return;
    }
    setSaving(true);
    try {
      await onAdd(value);
      setName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSection title={title} description={description}>
      {writable ? (
        <FormField label="Yeni kayıt">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
            <Button type="button" onClick={() => void add()} disabled={saving} className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              Ekle
            </Button>
          </div>
        </FormField>
      ) : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kayıt yok</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
            >
              <span className="text-sm font-medium">{row.name}</span>
              {writable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-600"
                  onClick={() => void onRemove(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
}

export function PersonnelSettingsButton({
  writable,
  onChanged,
}: {
  writable: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [titles, setTitles] = useState<JobTitleRow[]>([]);

  const loadRows = useCallback(async () => {
    const [dept, job] = await Promise.all([fetchDepartments(), fetchJobTitles()]);
    setDepartments(dept);
    setTitles(job);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadRows().catch(() => {
      setDepartments([]);
      setTitles([]);
    });
  }, [open, loadRows]);

  async function handleChanged() {
    await loadRows();
    onChanged?.();
  }

  return (
    <>
      <Button variant="outline" className="rounded-2xl" onClick={() => setOpen(true)}>
        <Settings className="mr-2 h-4 w-4" />
        Ayarlar
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        icon={Settings}
        title="Personel ayarları"
        description="Departman ve görev listesini buradan ekleyin veya silin. Personel formunda bu listelerden seçilir."
        className="max-w-3xl"
      >
        <FormSheetBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <CatalogColumn
              title="Departmanlar"
              description="Personel kaydında birim olarak seçilir."
              placeholder="Örn. Kalite Güvence"
              rows={departments}
              writable={writable}
              onAdd={async (name) => {
                await createDepartment(name);
                toast.success("Departman eklendi");
                await handleChanged();
              }}
              onRemove={async (row) => {
                if (!window.confirm(`${row.name} silinsin mi?`)) return;
                await deleteDepartment(row.id);
                toast.success("Departman silindi");
                await handleChanged();
              }}
            />
            <CatalogColumn
              title="Görevler"
              description="Personel kaydında unvan olarak seçilir."
              placeholder="Örn. Depo sorumlusu"
              rows={titles}
              writable={writable}
              onAdd={async (name) => {
                await createJobTitle(name);
                toast.success("Görev eklendi");
                await handleChanged();
              }}
              onRemove={async (row) => {
                if (!window.confirm(`${row.name} silinsin mi?`)) return;
                await deleteJobTitle(row.id);
                toast.success("Görev silindi");
                await handleChanged();
              }}
            />
          </div>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Kapat
          </Button>
        </FormSheetFooter>
      </FormDialog>
    </>
  );
}
