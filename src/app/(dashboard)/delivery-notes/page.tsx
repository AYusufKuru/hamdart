"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { DeliveryNoteFormSheet } from "@/components/catalog/delivery-note-form-sheet";
import type { DeliveryNote, DeliveryNoteLine } from "@/data/catalog";
import {
  deleteCatalog,
  fetchDeliveryNoteLines,
  fetchDeliveryNotes,
} from "@/lib/catalog-store";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/utils";

export default function DeliveryNotesPage() {
  const { canWrite } = useAuth();
  const writable = canWrite("delivery_notes");
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [noteLines, setNoteLines] = useState<DeliveryNoteLine[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryNote | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, lines] = await Promise.all([
        fetchDeliveryNotes(),
        fetchDeliveryNoteLines(),
      ]);
      setNotes(list);
      setNoteLines(lines);
      setSelected((prev) => prev ?? list[0]?.noteNo ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İrsaliyeler yüklenemedi");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lines = useMemo(
    () => noteLines.filter((l) => l.noteNo === selected),
    [noteLines, selected]
  );

  async function handleDelete(row: DeliveryNote) {
    if (!window.confirm(`${row.noteNo} silinsin mi?`)) return;
    try {
      await deleteCatalog("delivery-notes", row.id);
      toast.success("İrsaliye silindi");
      if (selected === row.noteNo) setSelected(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  const columns: Column<DeliveryNote>[] = [
    {
      key: "noteNo",
      header: "İrsaliye No",
      className: "font-mono text-sm",
      render: (r) => r.noteNo,
    },
    { key: "party", header: "Müşteri / Tedarikçi", render: (r) => r.party },
    { key: "kind", header: "Tür", render: (r) => r.kind },
    { key: "warehouse", header: "Depo", render: (r) => r.warehouse },
    {
      key: "issueDate",
      header: "Düzenleme",
      render: (r) => formatDate(r.issueDate),
    },
    {
      key: "shipDate",
      header: "Sevk",
      render: (r) => formatDate(r.shipDate),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <Badge variant="info">{r.status}</Badge>,
    },
    ...(writable
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24",
            render: (r: DeliveryNote) => (
              <CatalogRowActions
                onEdit={() => {
                  setEditing(r);
                  setOpen(true);
                }}
                onDelete={() => void handleDelete(r)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Sevk"
        title="İrsaliyeler"
        description="Satış ve alış irsaliyesi oluşturun, kalemleri girin."
        actions={
          <CanWrite resource="delivery_notes">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni irsaliye
            </Button>
          </CanWrite>
        }
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={notes}
            columns={columns}
            searchText={(r) =>
              `${r.noteNo} ${r.party} ${r.warehouse} ${r.status} ${r.relatedOrderNo} ${r.relatedInvoiceNo}`
            }
            onRowClick={(r) => setSelected(r.noteNo)}
            empty="Henüz irsaliye yok"
          />
        </CardContent>
      </Card>
      <Card className="glass-card border-none">
        <CardContent className="p-6 space-y-4">
          <p className="text-sm font-bold">İrsaliye kalemleri</p>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kalemleri görmek için önce bir irsaliye oluşturun.
            </p>
          ) : (
            <>
              <select
                className="h-10 min-w-[16rem] max-w-full rounded-xl border px-3 text-sm bg-background"
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                {notes.map((note) => (
                  <option key={note.id} value={note.noteNo}>
                    {note.noteNo}
                  </option>
                ))}
              </select>
              <SearchTable
                rows={lines}
                columns={[
                  {
                    key: "noteNo",
                    header: "İrsaliye No",
                    render: (r) => r.noteNo,
                  },
                  {
                    key: "description",
                    header: "Malzeme / açıklama",
                    render: (r) => r.description,
                  },
                  {
                    key: "qty",
                    header: "Miktar",
                    render: (r) => r.quantityLabel,
                  },
                  { key: "unit", header: "Birim", render: (r) => r.unit },
                ]}
                searchText={(r) => `${r.description} ${r.noteNo}`}
                empty="Bu irsaliyede kalem yok"
              />
            </>
          )}
        </CardContent>
      </Card>
      <DeliveryNoteFormSheet
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        editingLines={
          editing ? noteLines.filter((l) => l.noteNo === editing.noteNo) : []
        }
        onSaved={() => void refresh()}
      />
    </div>
  );
}
