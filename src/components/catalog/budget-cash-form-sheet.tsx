"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type {
  BudgetCashDirection,
  BudgetCashEntry,
  Customer,
  Invoice,
  Personnel,
  Supplier,
} from "@/data/catalog";
import {
  createBudgetEntry,
  createChequeNote,
  fetchCustomers,
  fetchInvoices,
  fetchPersonnel,
  fetchSuppliers,
  updateBudgetEntry,
} from "@/lib/catalog-store";
import {
  BUDGET_EXPENSE_CATEGORIES,
  BUDGET_INCOME_CATEGORIES,
  budgetDirectionLabel,
} from "@/lib/budget-cash";
import { buildChequeInstallments, chequeKindFromCategory } from "@/lib/cheque-notes";
import { isPurchaseInvoice, isSalesInvoice } from "@/lib/reports";
import { personnelDisplayName } from "@/lib/personnel";
import { formatNumber, plusMonthsIso, todayIso } from "@/lib/utils";
import { sameParty } from "@/lib/party-account";

type InstallmentDraft = { dueDate: string; amount: string; serialNo: string };

function emptyForm(row?: BudgetCashEntry | null) {
  return {
    party: row?.party ?? "",
    category: row?.category ?? "",
    amount: row ? String(row.amount) : "",
    date: row?.date || todayIso(),
    dueDate: row?.dueDate ?? "",
    description: row?.description ?? "",
    invoiceNo: row?.invoiceNo ?? "",
    bankName: "",
    serialNo: "",
    count: "4",
    amountEach: "100000",
    firstDue: plusMonthsIso(todayIso(), 1),
    intervalMonths: "1",
    installments: [] as InstallmentDraft[],
  };
}

export function BudgetCashFormSheet({
  open,
  onOpenChange,
  direction,
  editing,
  categories = [],
  defaultParty = "",
  lockParty = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: BudgetCashDirection;
  editing?: BudgetCashEntry | null;
  categories?: string[];
  defaultParty?: string;
  lockParty?: boolean;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!open) return;
    const base = emptyForm(editing ?? null);
    setForm({
      ...base,
      party: editing?.party || defaultParty || base.party,
    });
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
      fetchPersonnel().catch(() => [] as Personnel[]),
      fetchInvoices().catch(() => [] as Invoice[]),
    ]).then(([c, s, p, i]) => {
      setCustomers(c);
      setSuppliers(s);
      setPersonnel(p);
      setInvoices(i);
    });
  }, [open, editing, direction, defaultParty]);

  const partyOptions = useMemo(() => {
    const names = [
      ...customers.map((row) => row.name),
      ...suppliers.map((row) => row.name),
      ...personnel.map((row) => personnelDisplayName(row)),
      form.party,
    ];
    return [...new Set(names.filter(Boolean))].map((name) => ({ value: name, label: name }));
  }, [customers, suppliers, personnel, form.party]);

  const categoryOptions = useMemo(() => {
    const fallback = direction === "gider" ? BUDGET_EXPENSE_CATEGORIES : BUDGET_INCOME_CATEGORIES;
    const base = categories.length > 0 ? categories : [...fallback];
    const extra = form.category.trim() ? [form.category.trim()] : [];
    return [...new Set([...extra, ...base])].map((name) => ({ value: name, label: name }));
  }, [categories, direction, form.category]);

  const invoiceOptions = useMemo(() => {
    const filtered = invoices.filter((row) => {
      if (direction === "gider" ? !isPurchaseInvoice(row) : !isSalesInvoice(row)) return false;
      if (!form.party.trim()) return true;
      return sameParty(row.party, form.party);
    });
    const extra = form.invoiceNo.trim()
      ? [{ value: form.invoiceNo.trim(), label: form.invoiceNo.trim() }]
      : [];
    return [
      ...extra,
      ...filtered.map((row) => ({
        value: row.invoiceNo,
        label: `${row.invoiceNo} · ${row.party} · ${formatNumber(row.amount)} ₺`,
        keywords: `${row.invoiceNo} ${row.party}`,
      })),
    ];
  }, [invoices, direction, form.invoiceNo, form.party]);

  const chequeKind = editing ? null : chequeKindFromCategory(form.category);
  const chequeTotal = form.installments.reduce(
    (sum, row) => sum + (Number(String(row.amount).replace(",", ".")) || 0),
    0
  );

  function setCategory(category: string) {
    const nextKind = chequeKindFromCategory(category);
    setForm((f) => {
      if (!nextKind) return { ...f, category };
      const amount = Number(String(f.amountEach).replace(",", ".")) || 100000;
      const count = Number(f.count) || 4;
      const interval = Number(f.intervalMonths) || 1;
      const rows = buildChequeInstallments({
        firstDue: f.firstDue || plusMonthsIso(todayIso(), 1),
        count,
        amount,
        intervalMonths: interval,
        serialStart: f.serialNo,
      });
      return {
        ...f,
        category,
        installments: rows.map((row) => ({
          dueDate: row.dueDate,
          amount: String(row.amount),
          serialNo: row.serialNo,
        })),
      };
    });
  }

  function generatePlan() {
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
      toast.error("Firma seçin");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Çeşit seçin");
      return;
    }
    const chequeKindNow = editing ? null : chequeKindFromCategory(form.category);
    const installments = form.installments
      .map((row) => ({
        dueDate: row.dueDate,
        amount: Number(String(row.amount).replace(",", ".")),
        serialNo: row.serialNo.trim(),
      }))
      .filter((row) => row.dueDate && row.amount > 0);
    const amount = chequeKindNow
      ? installments.reduce((sum, row) => sum + row.amount, 0)
      : Number(String(form.amount).replace(",", "."));
    if (chequeKindNow && installments.length === 0) {
      toast.error("Vadeleri oluşturun");
      return;
    }
    if (!(amount > 0)) {
      toast.error("Miktar girin");
      return;
    }
    setSaving(true);
    try {
      if (chequeKindNow) {
        await createChequeNote({
          kind: chequeKindNow,
          direction: direction === "gider" ? "given" : "received",
          party: form.party.trim(),
          issueDate: form.date,
          bankName: form.bankName.trim(),
          serialNo: form.serialNo.trim(),
          notes: form.description.trim(),
          relatedInvoiceNo: form.invoiceNo.trim(),
          installments,
        });
        toast.success(`${chequeKindNow === "senet" ? "Senet" : "Çek"} kaydedildi`);
      } else {
        const body = {
          direction,
          party: form.party.trim(),
          category: form.category.trim(),
          amount,
          date: form.date,
          dueDate: form.dueDate.trim(),
          description: form.description.trim(),
          invoiceNo: form.invoiceNo.trim(),
        };
        if (editing) {
          await updateBudgetEntry(editing.id, body);
          toast.success(`${budgetDirectionLabel(direction)} güncellendi`);
        } else {
          await createBudgetEntry(body);
          toast.success(`${budgetDirectionLabel(direction)} eklendi`);
        }
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  const income = direction === "gelir";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={income ? TrendingUp : TrendingDown}
      title={editing ? `${budgetDirectionLabel(direction)} düzenle` : `${budgetDirectionLabel(direction)} ekle`}
      className={chequeKind ? "max-w-2xl" : undefined}
      description={
        income
          ? "Firma, tutar ve çeşit girin. Çek veya senet seçilince vade planı burada oluşturulur."
          : "Kasadan çıkan tutarı kaydedin. Fiş veya fatura gelince ilişkilendirin."
      }
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Hareket">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Firma" required>
                {lockParty ? (
                  <Input value={form.party} readOnly className="bg-muted/40" />
                ) : (
                  <SearchableSelect
                    value={form.party}
                    onValueChange={(party) => setForm((f) => ({ ...f, party }))}
                    options={partyOptions}
                    placeholder="Firma / kişi"
                    allowCustom
                  />
                )}
              </FormField>
              <FormField label="Çeşit" required>
                <SearchableSelect
                  value={form.category}
                  onValueChange={setCategory}
                  options={categoryOptions}
                  placeholder="Çeşit"
                />
              </FormField>
              {chequeKind ? (
                <FormField label="Toplam">
                  <Input value={`${formatNumber(chequeTotal)} ₺`} readOnly />
                </FormField>
              ) : (
              <FormField label="Miktar" required>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </FormField>
              )}
              <FormField label="Tarih" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </FormField>
              {chequeKind ? null : (
              <FormField
                label="Vade"
                optional
                hint="İleri tarihli (henüz çıkmamış) hareketler takvimde görünür. Vade yazılırsa takvim tarihi olarak kullanılır."
              >
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </FormField>
              )}
              <FormField
                label="Fatura / fiş"
                optional
                hint="Zorunlu değil. Belge sonra işlendiğinde buradan bağlanır."
              >
                <div className="space-y-2">
                  <SearchableSelect
                    value={form.invoiceNo}
                    onValueChange={(invoiceNo) => setForm((f) => ({ ...f, invoiceNo }))}
                    options={invoiceOptions}
                    placeholder="Fatura seçin veya no yazın"
                    allowCustom
                  />
                  {form.invoiceNo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setForm((f) => ({ ...f, invoiceNo: "" }))}
                    >
                      Bağlantıyı kaldır
                    </Button>
                  ) : null}
                </div>
              </FormField>
            </div>
            <FormField label="Açıklama" optional>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={
                  income
                    ? "Örn. Peşin tahsilat, faturası sonra kesilecek"
                    : "Örn. Çay alımı için kasadan verilen avans"
                }
                rows={3}
              />
            </FormField>
          </FormSection>
          {chequeKind ? (
            <FormSection
              title="Parçalı vade"
              description="Örnek: 4 ay, ayda 100.000 ₺. Vadeler takvimde görünür, fatura ödemesinde seçilir."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Banka" optional>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  />
                </FormField>
                <FormField label="İlk çek / senet no" optional>
                  <Input
                    value={form.serialNo}
                    onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
                  />
                </FormField>
                <FormField label="Adet">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={form.count}
                    onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                  />
                </FormField>
                <FormField label="Taksit tutarı">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.amountEach}
                    onChange={(e) => setForm((f) => ({ ...f, amountEach: e.target.value }))}
                  />
                </FormField>
                <FormField label="İlk vade">
                  <Input
                    type="date"
                    value={form.firstDue}
                    onChange={(e) => setForm((f) => ({ ...f, firstDue: e.target.value }))}
                  />
                </FormField>
                <FormField label="Aralık (ay)">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={form.intervalMonths}
                    onChange={(e) => setForm((f) => ({ ...f, intervalMonths: e.target.value }))}
                  />
                </FormField>
              </div>
              <Button type="button" variant="outline" onClick={generatePlan}>
                Vadeleri oluştur
              </Button>
              <div className="space-y-2">
                {form.installments.map((row, index) => (
                  <div key={`${row.dueDate}-${index}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                    <Input
                      type="date"
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
                      type="text"
                      inputMode="decimal"
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
                      placeholder="Belge no"
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
              </div>
            </FormSection>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
