"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import {
  ChequeNoteFormSheet,
  ChequeStatusDialog,
} from "@/components/catalog/cheque-note-form-sheet";
import type { ChequeNote } from "@/data/catalog";
import { deleteChequeNote, fetchChequeNotes } from "@/lib/catalog-store";
import {
  chequeDirectionLabel,
  chequeKindLabel,
  chequeStatusVariant,
  flattenChequeInstallments,
  normalizeChequeStatus,
} from "@/lib/cheque-notes";
import { formatDate, formatNumber } from "@/lib/utils";

export function ChequeNotesWorkspace({
  writable,
  onChanged,
  createOpen,
  onCreateOpenChange,
}: {
  writable: boolean;
  onChanged?: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState<ChequeNote[]>([]);
  const [kindFilter, setKindFilter] = useState<"all" | "cek" | "senet">("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "received" | "given">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChequeNote | null>(null);
  const [statusNote, setStatusNote] = useState<ChequeNote | null>(null);

  function setSheetOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setEditing(null);
      onCreateOpenChange?.(false);
    }
  }

  const refresh = useCallback(async () => {
    const rows = await fetchChequeNotes();
    setNotes(rows);
    onChanged?.();
  }, [onChanged]);

  useEffect(() => {
    void refresh().catch(() => setNotes([]));
  }, [refresh]);

  useEffect(() => {
    if (!createOpen) return;
    setEditing(null);
    setOpen(true);
  }, [createOpen]);

  const filtered = useMemo(
    () =>
      notes.filter((row) => {
        if (kindFilter !== "all" && row.kind !== kindFilter) return false;
        if (directionFilter !== "all" && row.direction !== directionFilter) return false;
        return true;
      }),
    [notes, kindFilter, directionFilter]
  );

  const rows = useMemo(() => flattenChequeInstallments(filtered), [filtered]);

  async function handleDelete(note: ChequeNote) {
    if (!window.confirm(`${note.docNo} silinsin mi?`)) return;
    try {
      await deleteChequeNote(note.id);
      toast.success("Kayıt silindi");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "docNo",
      header: "Plan no",
      className: "font-mono text-sm",
      render: (r) => r.docNo,
    },
    {
      key: "kind",
      header: "Tür",
      render: (r) => chequeKindLabel(r.kind),
    },
    {
      key: "direction",
      header: "Yön",
      render: (r) => chequeDirectionLabel(r.direction),
    },
    { key: "party", header: "Cari", render: (r) => r.party },
    {
      key: "serialNo",
      header: "Belge no",
      render: (r) => r.serialNo || "—",
    },
    {
      key: "dueDate",
      header: "Vade",
      render: (r) => formatDate(r.dueDate),
    },
    {
      key: "amount",
      header: "Tutar",
      className: "text-right font-bold",
      render: (r) => `${formatNumber(r.amount)} ${r.currency || "₺"}`,
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => (
        <Badge variant={chequeStatusVariant(r.instrumentStatus)}>
          {normalizeChequeStatus(r.instrumentStatus)}
        </Badge>
      ),
    },
    {
      key: "invoiceNo",
      header: "Fatura",
      render: (r) => r.invoiceNo || "—",
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: (r) => {
        const note = notes.find((item) => item.id === r.chequeNoteId);
        if (!writable || !note) return null;
        return (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Durum güncelle"
              onClick={(e) => {
                e.stopPropagation();
                setStatusNote(note);
              }}
            >
              <ClipboardCheck className="h-4 w-4" />
            </Button>
            <CatalogRowActions
              onEdit={() => {
                setEditing(note);
                setOpen(true);
              }}
              onDelete={() => void handleDelete(note)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Tümü"],
              ["cek", "Çek"],
              ["senet", "Senet"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={kindFilter === value ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setKindFilter(value)}
            >
              {label}
            </Button>
          ))}
          <span className="mx-1 h-8 w-px bg-border" />
          {(
            [
              ["all", "Alınan + verilen"],
              ["received", "Alınan"],
              ["given", "Verilen"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={directionFilter === value ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setDirectionFilter(value)}
            >
              {label}
            </Button>
          ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rows}
            columns={columns}
            searchText={(r) =>
              `${r.docNo} ${r.party} ${r.serialNo} ${r.invoiceNo} ${chequeKindLabel(r.kind)} ${normalizeChequeStatus(r.instrumentStatus)}`
            }
            empty="Kayıtlı çek veya senet yok"
          />
        </CardContent>
      </Card>

      <ChequeNoteFormSheet
        open={open}
        onOpenChange={setSheetOpen}
        editing={editing}
        onSaved={() => void refresh()}
      />
      <ChequeStatusDialog
        open={Boolean(statusNote)}
        onOpenChange={(next) => {
          if (!next) setStatusNote(null);
        }}
        note={statusNote}
        onSaved={() => void refresh()}
      />
    </div>
  );
}
