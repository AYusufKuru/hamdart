"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ScrollText, Trash2 } from "lucide-react";
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
import type { ChequeDirection, ChequeKind, ChequeNote, Customer, Supplier } from "@/data/catalog";
import {
  createChequeNote,
  fetchCustomers,
  fetchSuppliers,
  updateChequeNote,
} from "@/lib/catalog-store";
import {
  buildChequeInstallments,
  CHEQUE_DIRECTIONS,
  CHEQUE_KINDS,
} from "@/lib/cheque-notes";
import { formatNumber, plusMonthsIso, todayIso } from "@/lib/utils";

type InstallmentDraft = { dueDate: string; amount: string; serialNo: string };

function emptyForm(row?: ChequeNote | null) {
  return {
    kind: (row?.kind ?? "cek") as ChequeKind,
    direction: (row?.direction ?? "received") as ChequeDirection,
    party: row?.party ?? "",
    issueDate: row?.issueDate || todayIso(),
    bankName: row?.bankName ?? "",
    serialNo: row?.serialNo ?? "",
    notes: row?.notes ?? "",
    count: row?.installments.length ? String(row.installments.length) : "4",
    amountEach: row?.installments[0] ? String(row.installments[0].amount) : "100000",
    firstDue: row?.installments[0]?.dueDate || plusMonthsIso(todayIso(), 1),
    intervalMonths: "1",
    installments: (row?.installments ?? []).map((item) => ({
      dueDate: item.dueDate,
      amount: String(item.amount),
      serialNo: item.serialNo,
    })) as InstallmentDraft[],
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
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(editing ?? null));
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

  const previewTotal = form.installments.reduce((sum, row) => sum + (Number(row.amount.replace(",", ".")) || 0), 0);

  function generate() {
    const count = Number(form.count);
    const amount = Number(String(form.amountEach).replace(",", "."));
    const interval = Number(form.intervalMonths);
    if (!(count >= 1) || !(amount > 0) || !(interval >= 1)) {
      toast.error("Taksit sayısı, tutar ve ay aralığı girin");
      return;
    }
    const rows = buildChequeInstallments({
      firstDue: form.firstDue,
      count,
      amount,
      intervalMonths: interval,
      serialStart: form.serialNo,
    });
    setForm((f) => ({
      ...f,
      installments: rows.map((row) => ({
        dueDate: row.dueDate,
        amount: String(row.amount),
        serialNo: row.serialNo,
      })),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.party.trim()) {
      toast.error("Cari seçin");
      return;
    }
    const installments = form.installments
      .map((row) => ({
        dueDate: row.dueDate,
        amount: Number(String(row.amount).replace(",", ".")),
        serialNo: row.serialNo.trim(),
      }))
      .filter((row) => row.dueDate && row.amount > 0);
    if (installments.length === 0) {
      toast.error("En az bir vade girin veya planı oluşturun");
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

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ScrollText}
      title={editing ? "Çek / senet düzenle" : "Yeni çek / senet"}
      description="Örnek: 4 ay, ayda 100.000 ₺. Vadeler oluşturulur, fatura ödemesinde seçilir."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
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
            <FormField label="Cari" required>
              <SearchableSelect
                value={form.party}
                onValueChange={(party) => setForm((f) => ({ ...f, party }))}
                options={partyOptions}
                placeholder={form.direction === "given" ? "Tedarikçi" : "Müşteri"}
                allowCustom
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Düzenleme tarihi" htmlFor="chn-issue" required>
                <Input
                  id="chn-issue"
                  type="date"
                  className="bg-white"
                  value={form.issueDate}
                  onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                />
              </FormField>
              <FormField label="Banka" htmlFor="chn-bank" optional>
                <Input
                  id="chn-bank"
                  className="bg-white"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                />
              </FormField>
            </div>
            <FormField label="İlk çek / senet no" htmlFor="chn-serial" optional>
              <Input
                id="chn-serial"
                className="bg-white"
                value={form.serialNo}
                onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Parçalı vade"
            description="4 aylık 100.000 ₺ gibi eşit taksit üretin, sonra tarihleri elle düzeltin."
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <FormField label="Adet" htmlFor="chn-count">
                <Input
                  id="chn-count"
                  type="number"
                  min={1}
                  max={24}
                  className="bg-white"
                  disabled={locked}
                  value={form.count}
                  onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                />
              </FormField>
              <FormField label="Taksit tutarı" htmlFor="chn-amt">
                <Input
                  id="chn-amt"
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="bg-white"
                  disabled={locked}
                  value={form.amountEach}
                  onChange={(e) => setForm((f) => ({ ...f, amountEach: e.target.value }))}
                />
              </FormField>
              <FormField label="İlk vade" htmlFor="chn-due">
                <Input
                  id="chn-due"
                  type="date"
                  className="bg-white"
                  disabled={locked}
                  value={form.firstDue}
                  onChange={(e) => setForm((f) => ({ ...f, firstDue: e.target.value }))}
                />
              </FormField>
              <FormField label="Aralık (ay)" htmlFor="chn-int">
                <Input
                  id="chn-int"
                  type="number"
                  min={1}
                  max={12}
                  className="bg-white"
                  disabled={locked}
                  value={form.intervalMonths}
                  onChange={(e) => setForm((f) => ({ ...f, intervalMonths: e.target.value }))}
                />
              </FormField>
            </div>
            <Button type="button" variant="outline" onClick={generate} disabled={locked}>
              Vadeleri oluştur
            </Button>
            <div className="space-y-2">
              {form.installments.map((row, index) => (
                <div key={`${row.dueDate}-${index}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <Input
                    type="date"
                    className="bg-white"
                    disabled={locked}
                    value={row.dueDate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        installments: f.installments.map((item, i) =>
                          i === index ? { ...item, dueDate: e.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="bg-white"
                    disabled={locked}
                    value={row.amount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        installments: f.installments.map((item, i) =>
                          i === index ? { ...item, amount: e.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Input
                    className="bg-white"
                    placeholder="Belge no"
                    disabled={locked}
                    value={row.serialNo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        installments: f.installments.map((item, i) =>
                          i === index ? { ...item, serialNo: e.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={locked}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        installments: f.installments.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!locked ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      installments: [
                        ...f.installments,
                        {
                          dueDate: plusMonthsIso(f.firstDue || todayIso(), f.installments.length),
                          amount: f.amountEach,
                          serialNo: "",
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Vade ekle
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Faturaya bağlanmış vadeler kilitlidir.</p>
              )}
            </div>
            <p className="text-sm font-medium">Toplam {formatNumber(previewTotal)} ₺</p>
          </FormSection>

          <FormSection title="Not" >
            <FormField label="Açıklama" htmlFor="chn-note" optional>
              <Textarea
                id="chn-note"
                className="bg-white"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
