"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchTable, type Column } from "@/components/shared/search-table";
import { CanWrite } from "@/components/auth/can-write";
import { CatalogRowActions } from "@/components/catalog/catalog-row-actions";
import { DeliveryNoteFormSheet } from "@/components/catalog/delivery-note-form-sheet";
import type { DeliveryNote, DeliveryNoteLine, DocumentSettings } from "@/data/catalog";
import {
  deleteCatalog,
  fetchDeliveryNoteLines,
  fetchDeliveryNotes,
  fetchDocumentSettings,
} from "@/lib/catalog-store";
import { EMPTY_DOCUMENT_SETTINGS } from "@/lib/document-company";
import { useAuth } from "@/lib/auth/auth-context";
import { downloadDeliveryNotePdf } from "@/lib/delivery-note-pdf";
import { formatDate } from "@/lib/utils";

export function DeliveryNotesWorkspace() {
  const { canWrite } = useAuth();
  const writable = canWrite("delivery_notes");
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [noteLines, setNoteLines] = useState<DeliveryNoteLine[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(EMPTY_DOCUMENT_SETTINGS);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryNote | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, lines, company] = await Promise.all([
        fetchDeliveryNotes(),
        fetchDeliveryNoteLines(),
        fetchDocumentSettings().catch(() => EMPTY_DOCUMENT_SETTINGS),
      ]);
      setNotes(list);
      setNoteLines(lines);
      setSettings(company);
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

  async function handlePdf(row: DeliveryNote) {
    try {
      const docLines = noteLines.filter((l) => l.noteNo === row.noteNo);
      await downloadDeliveryNotePdf(row, docLines, settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF oluşturulamadı");
    }
  }

  const columns: Column<DeliveryNote>[] = [
    {
      key: "noteNo",
      header: "İrsaliye No",
      className: "font-mono text-sm",
      render: (r) => r.noteNo,
    },
    { key: "party", header: "Cari", render: (r) => r.party },
    {
      key: "kind",
      header: "Tür",
      render: (r) => (r.kind === "Alış" ? "Mal kabul" : "Sevk"),
    },
    { key: "warehouse", header: "Depo", render: (r) => r.warehouse },
    {
      key: "shipDate",
      header: "Sevk",
      render: (r) => formatDate(r.shipDate),
    },
    {
      key: "plateNo",
      header: "Plaka",
      render: (r) => r.plateNo || "—",
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => <Badge variant="info">{r.status}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="PDF indir"
            onClick={(e) => {
              e.stopPropagation();
              void handlePdf(r);
            }}
          >
            <FileDown className="h-4 w-4" />
          </Button>
          {writable ? (
            <CatalogRowActions
              onEdit={() => {
                setEditing(r);
                setOpen(true);
              }}
              onDelete={() => void handleDelete(r)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CanWrite resource="delivery_notes">
          <Button
            className="rounded-2xl bg-linear-to-r from-indigo-600 to-blue-500 border-none"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni sevk irsaliyesi
          </Button>
        </CanWrite>
      </div>
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={notes}
            columns={columns}
            searchText={(r) =>
              `${r.noteNo} ${r.party} ${r.warehouse} ${r.status} ${r.relatedOrderNo} ${r.relatedInvoiceNo} ${r.plateNo} ${r.trailerPlate} ${r.driverName} ${r.dispatchAddress} ${r.partyCity} ${r.partyDistrict}`
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
                    key: "description",
                    header: "Malın cinsi",
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
