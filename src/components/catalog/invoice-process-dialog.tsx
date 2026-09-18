"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Banknote, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { Invoice } from "@/data/catalog";
import {
  fetchAvailableChequeInstallments,
  postInvoiceEvent,
} from "@/lib/catalog-store";
import {
  chequeDirectionLabel,
  chequeKindFromMethod,
  chequeKindLabel,
  paymentMethodForKind,
} from "@/lib/cheque-notes";
import {
  documentTypeFromKind,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
} from "@/lib/invoice-docs";
import { formatDate, formatNumber } from "@/lib/utils";

type AvailableInstallment = Awaited<ReturnType<typeof fetchAvailableChequeInstallments>>[number];

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function paymentDirection(invoice: Invoice) {
  const type = documentTypeFromKind(invoice.kind, invoice.documentType);
  return type === "purchase" ? "given" : "received";
}

export function InvoiceProcessDialog({
  open,
  onOpenChange,
  mode,
  invoice,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "status" | "payment";
  invoice: Invoice | null;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState("Onaylandı");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Havale / EFT");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<AvailableInstallment[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const remaining = invoice
    ? Math.max(0, round2((invoice.amount || 0) - (invoice.paidAmount || 0)))
    : 0;
  const chequeKind = chequeKindFromMethod(method);
  const direction = invoice ? paymentDirection(invoice) : "received";
  const chequeTotal = useMemo(
    () =>
      round2(
        available
          .filter((row) => selectedIds.includes(row.id))
          .reduce((sum, row) => sum + Number(row.amount || 0), 0)
      ),
    [available, selectedIds]
  );

  function reset(nextInvoice: Invoice | null) {
    setStatus(
      nextInvoice?.status === "Proforma" ? "Onaylandı" : nextInvoice?.status || "Onaylandı"
    );
    setAmount(
      nextInvoice ? String(round2(Math.max(0, nextInvoice.amount - (nextInvoice.paidAmount || 0)))) : ""
    );
    setMethod("Havale / EFT");
    setNote("");
    setFile(null);
    setSaving(false);
    setAvailable([]);
    setSelectedIds([]);
  }

  useEffect(() => {
    if (!open || mode !== "payment" || !invoice || !chequeKind) {
      return;
    }
    void fetchAvailableChequeInstallments({
      kind: chequeKind,
      direction,
      party: invoice.party,
    })
      .then(setAvailable)
      .catch(() => setAvailable([]));
  }, [open, mode, invoice, chequeKind, direction]);

  useEffect(() => {
    if (!chequeKind) return;
    if (chequeTotal > 0) setAmount(String(chequeTotal));
  }, [chequeKind, chequeTotal]);

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.set("invoiceNo", invoice.invoiceNo);
      form.set("kind", mode);
      form.set("note", note);
      if (file) form.set("file", file);
      if (mode === "payment") {
        let installmentIds = [...selectedIds];
        if (chequeKind && installmentIds.length === 0) {
          toast.error("Portföyden çek/senet seçin. Yeni plan Bütçe gelirinden eklenir.");
          setSaving(false);
          return;
        }
        form.set("amount", amount.replace(",", "."));
        form.set("method", method);
        if (installmentIds.length > 0) {
          form.set("installmentIds", JSON.stringify(installmentIds));
          const label = paymentMethodForKind(chequeKind ?? "cek");
          const extra = `${label} ile ${installmentIds.length} vade`;
          form.set("note", note ? `${note} · ${extra}` : extra);
        }
      } else {
        form.set("status", status);
      }
      await postInvoiceEvent(form);
      toast.success(mode === "payment" ? "Ödeme kaydedildi" : "Durum güncellendi");
      onOpenChange(false);
      reset(invoice);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next && invoice) reset(invoice);
        onOpenChange(next);
      }}
      icon={mode === "payment" ? Banknote : ClipboardCheck}
      title={mode === "payment" ? "Ödeme al" : "Durumu güncelle"}
      description={
        invoice
          ? `${invoice.invoiceNo} · kalan ${formatNumber(remaining)} ${invoice.currency || "₺"}`
          : undefined
      }
      className={chequeKind ? "max-w-2xl" : "max-w-lg"}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          {mode === "status" ? (
            <FormSection title="Yeni durum">
              <FormField label="Durum" required>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </FormSection>
          ) : (
            <FormSection title="Ödeme">
              <FormField label="Tutar" htmlFor="pay-amt" required>
                <Input
                  id="pay-amt"
                  type="number"
                  min={0.01}
                  step="0.01"
                  required={!chequeKind}
                  readOnly={Boolean(chequeKind)}
                  className="bg-white"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </FormField>
              <FormField label="Yöntem" required>
                <Select
                  value={method}
                  onValueChange={(next) => {
                    setMethod(next);
                    setSelectedIds([]);
                    setUseNewPlan(false);
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </FormSection>
          )}

          {mode === "payment" && chequeKind ? (
            <>
              <FormSection
                title={`Portföydeki ${chequeKindLabel(chequeKind)}ler`}
                description={`${chequeDirectionLabel(direction)} kayıtlar. Fatura carisi üstte sıralanır.`}
              >
                {available.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Bekleyen vade yok. Yeni çek/senet Bütçe → Gelir ekranından eklenir.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {available.map((row) => {
                      const checked = selectedIds.includes(row.id);
                      return (
                        <label
                          key={row.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId(row.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{row.docNo}</span>
                            <span className="text-muted-foreground"> · {row.party}</span>
                            <span className="block text-xs text-muted-foreground">
                              vade {formatDate(row.dueDate)}
                              {row.serialNo ? ` · no ${row.serialNo}` : ""}
                            </span>
                          </span>
                          <span className="font-semibold">{formatNumber(row.amount)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </FormSection>
              {chequeTotal > 0 ? (
                <p className="px-1 text-sm font-medium">Seçilen toplam {formatNumber(chequeTotal)} ₺</p>
              ) : null}
            </>
          ) : null}

          <FormSection title="Açıklama ve dekont">
            <FormField label="Not" htmlFor="pay-note" optional>
              <Textarea
                id="pay-note"
                className="bg-white"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
            <FormField label="Dekont / ek dosya" optional>
              <Input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="bg-white"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </FormField>
            <p className="text-xs text-muted-foreground">PDF veya görsel, en fazla 5 MB.</p>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !invoice}>
            {saving ? "Kaydediliyor…" : mode === "payment" ? "Ödemeyi kaydet" : "Durumu kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
