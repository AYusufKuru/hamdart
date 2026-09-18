"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
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
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  ChequeInstallmentCountField,
  ChequeInstallmentStep,
  emptyChequePlan,
  fillChequePlanStep,
  type ChequePlanDraft,
} from "@/components/catalog/cheque-plan-fields";
import type { ChequeDirection, ChequeKind, ChequeNote, Customer, Supplier } from "@/data/catalog";
import {
  createChequeNote,
  fetchCustomers,
  fetchSuppliers,
  updateChequeNote,
} from "@/lib/catalog-store";
import {
  CHEQUE_DIRECTIONS,
  CHEQUE_KINDS,
  CHEQUE_STATUSES,
  normalizeChequeStatus,
  parseChequeMoney,
} from "@/lib/cheque-notes";
import { formatNumber, todayIso } from "@/lib/utils";

function emptyForm(row?: ChequeNote | null) {
  const many = (row?.installments.length ?? 0) > 1;
  return {
    kind: (row?.kind ?? "cek") as ChequeKind,
    direction: (row?.direction ?? "received") as ChequeDirection,
    party: row?.party ?? "",
    issueDate: row?.issueDate || todayIso(),
    bankName: row?.bankName ?? "",
    serialNo: row?.serialNo ?? "",
    notes: row?.notes ?? "",
    amount: row ? String(row.totalAmount) : "",
    installmentCount: many ? String(row?.installments.length) : "none",
    installments: many
      ? (row?.installments ?? []).map((item) => ({
          dueDate: item.dueDate,
          amount: String(item.amount),
        }))
      : ([] as ChequePlanDraft[]),
  };
}

export function ChequeNoteFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ChequeNote | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(editing ?? null));
    setStep(0);
    setSaving(false);
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
    ]).then(([c, s]) => {
      setCustomers(c);
      setSuppliers(s);
    });
  }, [open, editing]);

  const locked = Boolean(editing?.installments.some((row) => row.status !== "Bekliyor"));
  const partyOptions = useMemo(() => {
    const names = form.direction === "given" ? suppliers.map((row) => row.name) : customers.map((row) => row.name);
    const extra = form.party.trim() ? [form.party] : [];
    return [...new Set([...extra, ...names])]
      .filter(Boolean)
      .map((name) => ({ value: name, label: name }));
  }, [customers, suppliers, form.direction, form.party]);

  const totalAmount = parseChequeMoney(form.amount);
  const installmentCount =
    form.installmentCount === "none" ? 0 : Number(form.installmentCount) || 0;
  const inWizard = installmentCount >= 2 && step > 0;
  const wizardIndex = Math.max(0, step - 1);
  const kindLabel = form.kind === "senet" ? "Senet" : "Çek";

  function setInstallmentCount(value: string) {
    const count = value === "none" ? 0 : Number(value) || 0;
    setForm((f) => ({
      ...f,
      installmentCount: value,
      installments: count >= 2 ? emptyChequePlan(count) : [],
    }));
    setStep(0);
  }

  function currentInstallments() {
    return form.installments
      .map((row) => ({
        dueDate: row.dueDate,
        amount: parseChequeMoney(row.amount),
        serialNo: form.serialNo.trim(),
      }))
      .filter((row) => row.dueDate && row.amount > 0);
  }

  async function save(installments: { dueDate: string; amount: number; serialNo: string }[]) {
    if (!form.party.trim()) {
      toast.error("Firma seçin");
      return;
    }
    if (!(totalAmount > 0)) {
      toast.error(`${kindLabel} tutarı girin`);
      return;
    }
    if (installments.length === 0) {
      toast.error("Vade bilgisi eksik");
      return;
    }
    const sum = installments.reduce((s, row) => s + row.amount, 0);
    if (installmentCount >= 2 && Math.abs(sum - totalAmount) > 0.05) {
      toast.error(
        `Taksitler ${formatNumber(sum)} ₺, ${kindLabel.toLocaleLowerCase("tr")} tutarı ${formatNumber(totalAmount)} ₺ olmalı`
      );
      return;
    }
    setSaving(true);
    try {
      const body = {
        kind: form.kind,
        direction: form.direction,
        party: form.party.trim(),
        issueDate: form.issueDate,
        bankName: form.bankName.trim(),
        serialNo: form.serialNo.trim(),
        notes: form.notes.trim(),
        ...(locked ? {} : { installments }),
      };
      if (editing) {
        await updateChequeNote(editing.id, body);
        toast.success("Çek / senet güncellendi");
      } else {
        await createChequeNote(body);
        toast.success("Çek / senet kaydedildi");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  function handleHeaderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.party.trim()) {
      toast.error("Firma seçin");
      return;
    }
    if (!(totalAmount > 0)) {
      toast.error(`${kindLabel} tutarı girin`);
      return;
    }
    if (locked) {
      void save(currentInstallments());
      return;
    }
    if (installmentCount < 2) {
      void save([
        {
          dueDate: form.issueDate,
          amount: totalAmount,
          serialNo: form.serialNo.trim(),
        },
      ]);
      return;
    }
    setForm((f) => ({
      ...f,
      installments: fillChequePlanStep(
        f.installments.length === installmentCount ? f.installments : emptyChequePlan(installmentCount),
        0,
        totalAmount,
        f.issueDate
      ),
    }));
    setStep(1);
  }

  function handleStepNext() {
    const row = form.installments[wizardIndex];
    if (!row?.dueDate || !(parseChequeMoney(row.amount) > 0)) {
      toast.error("Taksit tutarı ve vade tarihi girin");
      return;
    }
    if (wizardIndex + 1 >= installmentCount) {
      void save(currentInstallments());
      return;
    }
    setForm((f) => ({
      ...f,
      installments: fillChequePlanStep(f.installments, wizardIndex + 1, totalAmount, f.issueDate),
    }));
    setStep(wizardIndex + 2);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ScrollText}
      title={
        inWizard
          ? `${kindLabel} taksiti ${wizardIndex + 1} / ${installmentCount}`
          : editing
            ? "Çek / senet düzenle"
            : `Yeni ${kindLabel.toLocaleLowerCase("tr")}`
      }
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleHeaderSubmit}>
        <FormSheetBody className="space-y-5">
          {inWizard ? (
            <ChequeInstallmentStep
              index={wizardIndex}
              count={installmentCount}
              totalAmount={totalAmount}
              previousAmounts={form.installments
                .slice(0, wizardIndex)
                .map((row) => parseChequeMoney(row.amount))}
              row={form.installments[wizardIndex] ?? { dueDate: "", amount: "" }}
              locked={locked}
              onChange={(row) =>
                setForm((f) => ({
                  ...f,
                  installments: f.installments.map((item, i) => (i === wizardIndex ? row : item)),
                }))
              }
            />
          ) : (
            <>
              <FormSection title="Belge">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Tür" required>
                    <Select
                      value={form.kind}
                      onValueChange={(kind) => setForm((f) => ({ ...f, kind: kind as ChequeKind }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHEQUE_KINDS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Yön" required>
                    <Select
                      value={form.direction}
                      onValueChange={(direction) =>
                        setForm((f) => ({ ...f, direction: direction as ChequeDirection, party: "" }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHEQUE_DIRECTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Firma" required>
                  <SearchableSelect
                    value={form.party}
                    onValueChange={(party) => setForm((f) => ({ ...f, party }))}
                    options={partyOptions}
                    placeholder={form.direction === "given" ? "Tedarikçi" : "Müşteri"}
                    allowCustom
                  />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Banka" htmlFor="chn-bank" optional>
                    <Input
                      id="chn-bank"
                      className="bg-white"
                      value={form.bankName}
                      onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                    />
                  </FormField>
                  <FormField
                    label={form.kind === "senet" ? "Senet no" : "Çek no"}
                    htmlFor="chn-serial"
                    optional
                  >
                    <Input
                      id="chn-serial"
                      className="bg-white"
                      value={form.serialNo}
                      onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
                    />
                  </FormField>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={`${kindLabel} tutarı`} htmlFor="chn-amt" required>
                    <Input
                      id="chn-amt"
                      type="text"
                      inputMode="decimal"
                      className="bg-white"
                      disabled={locked}
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Düzenleme tarihi" htmlFor="chn-issue" required>
                    <Input
                      id="chn-issue"
                      type="date"
                      className="bg-white"
                      value={form.issueDate}
                      onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    />
                  </FormField>
                </div>
                <ChequeInstallmentCountField
                  value={form.installmentCount}
                  onChange={setInstallmentCount}
                  disabled={locked}
                />
              </FormSection>
              <FormSection title="Not">
                <FormField label="Açıklama" htmlFor="chn-note" optional>
                  <Textarea
                    id="chn-note"
                    className="bg-white"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </FormField>
              </FormSection>
              {locked ? (
                <p className="text-xs text-muted-foreground">
                  Faturaya bağlanmış vadeler kilitlidir.
                </p>
              ) : null}
            </>
          )}
        </FormSheetBody>
        <FormSheetFooter>
          {inWizard ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Geri
              </Button>
              <Button type="button" disabled={saving} onClick={handleStepNext}>
                {saving
                  ? "Kaydediliyor…"
                  : wizardIndex + 1 >= installmentCount
                    ? "Kaydet"
                    : "Sonraki taksit"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Kaydediliyor…"
                  : installmentCount >= 2
                    ? "Taksitlere geç"
                    : "Kaydet"}
              </Button>
            </>
          )}
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}

export function ChequeStatusDialog({
  open,
  onOpenChange,
  note,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: ChequeNote | null;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState<(typeof CHEQUE_STATUSES)[number]>("Bekliyor");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !note) return;
    setStatus(normalizeChequeStatus(note.status));
    setSaving(false);
  }, [open, note]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note) return;
    setSaving(true);
    try {
      await updateChequeNote(note.id, { status });
      toast.success("Durum güncellendi");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Durum güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ScrollText}
      title="Çek / senet durumu"
      description={note ? `${note.docNo} · ${note.party}` : undefined}
      className="max-w-md"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Durum">
            <FormField label="Durum" required>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as (typeof CHEQUE_STATUSES)[number])}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHEQUE_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !note}>
            {saving ? "Kaydediliyor…" : "Durumu kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
