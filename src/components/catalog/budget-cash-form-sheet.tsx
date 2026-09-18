"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TrendingDown, TrendingUp } from "lucide-react";
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
import { chequeKindFromCategory, parseChequeMoney } from "@/lib/cheque-notes";
import { isPurchaseInvoice, isSalesInvoice } from "@/lib/reports";
import { personnelDisplayName } from "@/lib/personnel";
import { formatNumber, todayIso } from "@/lib/utils";
import { sameParty } from "@/lib/party-account";
import {
  ChequeInstallmentCountField,
  ChequeInstallmentStep,
  emptyChequePlan,
  fillChequePlanStep,
  type ChequePlanDraft,
} from "@/components/catalog/cheque-plan-fields";

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
    installmentCount: "none",
    installments: [] as ChequePlanDraft[],
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
  const [chequeStep, setChequeStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (!open) return;
    const base = emptyForm(editing ?? null);
    setChequeStep(0);
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
  const chequeAmount = parseChequeMoney(form.amount);
  const chequeInstallmentCount =
    form.installmentCount === "none" ? 0 : Number(form.installmentCount) || 0;

  function setCategory(category: string) {
    setChequeStep(0);
    setForm((f) => ({
      ...f,
      category,
      installmentCount: chequeKindFromCategory(category) ? f.installmentCount : "none",
      installments: chequeKindFromCategory(category) ? f.installments : [],
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
    const installments =
      chequeInstallmentCount >= 2
        ? form.installments
            .map((row) => ({
              dueDate: row.dueDate,
              amount: parseChequeMoney(row.amount),
              serialNo: form.serialNo.trim(),
            }))
            .filter((row) => row.dueDate && row.amount > 0)
        : chequeKindNow && chequeAmount > 0
          ? [
              {
                dueDate: form.dueDate.trim() || form.date,
                amount: chequeAmount,
                serialNo: form.serialNo.trim(),
              },
            ]
          : [];
    const amount = chequeKindNow
      ? chequeAmount || installments.reduce((sum, row) => sum + row.amount, 0)
      : parseChequeMoney(form.amount);
    if (chequeKindNow && chequeInstallmentCount >= 2 && installments.length !== chequeInstallmentCount) {
      toast.error("Taksit tutarı ve vade tarihlerini adım adım tamamlayın");
      return;
    }
    if (chequeKindNow && installments.length === 0) {
      toast.error(`${chequeKindNow === "senet" ? "Senet" : "Çek"} tutarı girin`);
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
              <FormField label={chequeKind ? `${chequeKind === "senet" ? "Senet" : "Çek"} tutarı` : "Miktar"} required>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </FormField>
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
            <FormSection title="Banka ve taksit">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Banka" optional>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  />
                </FormField>
                <FormField label={chequeKind === "senet" ? "Senet no" : "Çek no"} optional>
                  <Input
                    value={form.serialNo}
                    onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
                  />
                </FormField>
                <ChequeInstallmentCountField
                  value={form.installmentCount}
                  onChange={(value) => {
                    const count = value === "none" ? 0 : Number(value) || 0;
                    setChequeStep(0);
                    setForm((f) => ({
                      ...f,
                      installmentCount: value,
                      installments:
                        count >= 2
                          ? fillChequePlanStep(
                              emptyChequePlan(count),
                              0,
                              parseChequeMoney(f.amount),
                              f.date
                            )
                          : [],
                    }));
                  }}
                />
              </div>
              {chequeInstallmentCount >= 2 ? (
                <div className="space-y-3">
                  <ChequeInstallmentStep
                    index={chequeStep}
                    count={chequeInstallmentCount}
                    totalAmount={chequeAmount}
                    previousAmounts={form.installments
                      .slice(0, chequeStep)
                      .map((row) => parseChequeMoney(row.amount))}
                    row={form.installments[chequeStep] ?? { dueDate: "", amount: "" }}
                    onChange={(row) =>
                      setForm((f) => ({
                        ...f,
                        installments: (f.installments.length === chequeInstallmentCount
                          ? f.installments
                          : emptyChequePlan(chequeInstallmentCount)
                        ).map((item, i) => (i === chequeStep ? row : item)),
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={chequeStep <= 0}
                      onClick={() => setChequeStep((n) => Math.max(0, n - 1))}
                    >
                      Geri
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const current = form.installments[chequeStep];
                        if (!current?.dueDate || !(parseChequeMoney(current.amount) > 0)) {
                          toast.error("Taksit tutarı ve vade tarihi girin");
                          return;
                        }
                        if (chequeStep + 1 >= chequeInstallmentCount) {
                          toast.success("Taksitler tamam. Kaydedebilirsiniz.");
                          return;
                        }
                        setForm((f) => ({
                          ...f,
                          installments: fillChequePlanStep(
                            f.installments.length === chequeInstallmentCount
                              ? f.installments
                              : emptyChequePlan(chequeInstallmentCount),
                            chequeStep + 1,
                            parseChequeMoney(f.amount),
                            f.date
                          ),
                        }));
                        setChequeStep((n) => n + 1);
                      }}
                    >
                      {chequeStep + 1 >= chequeInstallmentCount ? "Taksitler tamam" : "Sonraki taksit"}
                    </Button>
                  </div>
                </div>
              ) : null}
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
