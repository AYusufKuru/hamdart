"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Banknote,
  FileText,
  Landmark,
  MapPin,
  PackagePlus,
  Pencil,
  Receipt,
  ScrollText,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CanWrite } from "@/components/auth/can-write";
import { BudgetCashFormSheet } from "@/components/catalog/budget-cash-form-sheet";
import { ChequeNoteFormSheet } from "@/components/catalog/cheque-note-form-sheet";
import { CustomerFormSheet } from "@/components/catalog/customer-form-sheet";
import { DeliveryNoteFormSheet } from "@/components/catalog/delivery-note-form-sheet";
import { InvoiceFormSheet } from "@/components/catalog/invoice-form-sheet";
import { PartyAccountPanel } from "@/components/catalog/party-account-panel";
import { QuoteFormSheet } from "@/components/catalog/quote-form-sheet";
import { SupplierFormSheet } from "@/components/catalog/supplier-form-sheet";
import { RawMaterialOrderFormSheet } from "@/components/raw-material-orders/raw-material-order-form-sheet";
import type {
  BudgetCashDirection,
  BudgetCategory,
  Customer,
  Supplier,
} from "@/data/catalog";
import { useAuth } from "@/lib/auth/auth-context";
import type { InvoiceDocumentType } from "@/lib/invoice-docs";
import { moneyTry, type PartyAccountSummary } from "@/lib/party-account";
import { parseGuarantors, parseRelatives } from "@/lib/supplier-card";

type PartyCard = Customer | Supplier;
type PartyRole = "customer" | "supplier";
type SheetKey =
  | "invoice"
  | "quote"
  | "delivery"
  | "cheque"
  | "cash"
  | "rawMaterial";

function formatIban(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const text =
    value == null || value === ""
      ? "—"
      : typeof value === "number"
        ? String(value)
        : value;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{text}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  hint,
  onClick,
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick: () => void;
  tone?: "slate" | "indigo" | "emerald" | "rose" | "amber" | "sky";
}) {
  const tones = {
    slate: "bg-slate-50 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-800",
    sky: "bg-sky-50 text-sky-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`mb-3 inline-flex rounded-xl p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

export function PartyDetailWorkspace({
  role,
  party,
  account,
  categories,
  empty,
  avgLabel,
  listHref,
  onSaved,
}: {
  role: PartyRole;
  party: PartyCard;
  account: PartyAccountSummary;
  categories: BudgetCategory[];
  empty: string;
  avgLabel: string;
  listHref: string;
  onSaved: () => void;
}) {
  const { canWrite } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceDocumentType>("sales");
  const [cashDirection, setCashDirection] = useState<BudgetCashDirection>(
    role === "supplier" ? "gider" : "gelir"
  );

  const isCustomer = role === "customer";
  const address = [party.address, party.district, party.city, party.country]
    .filter(Boolean)
    .join(" · ");
  const contact = [party.mobile || party.contact, party.email, party.taxNo]
    .filter(Boolean)
    .join(" · ");
  const relatives = parseRelatives(party.relatives).filter((row) => row.name || row.phone);
  const guarantors = parseGuarantors(party.guarantors).filter(
    (row) => row.name || row.phone || row.nationalId
  );

  function openInvoice(type: InvoiceDocumentType) {
    setInvoiceType(type);
    setSheet("invoice");
  }

  function openCash(direction: BudgetCashDirection) {
    setCashDirection(direction);
    setSheet("cash");
  }

  return (
    <div className="min-h-full space-y-8 p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageHeader
        badge={isCustomer ? "Müşteri kartı" : "Tedarikçi kartı"}
        title={party.name}
        description={
          [
            party.invoiceName && party.invoiceName !== party.name ? party.invoiceName : "",
            address,
            party.accountCode,
          ]
            .filter(Boolean)
            .join(" · ") || (isCustomer ? "Müşteri hesap ekstresi" : "Tedarikçi hesap ekstresi")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={listHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Listeye dön
              </Link>
            </Button>
            {canWrite(isCustomer ? "customers" : "suppliers") ? (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Kartı düzenle
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden border-none bg-linear-to-br from-sky-50 via-white to-indigo-50 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight">{party.name}</h2>
                  <Badge variant={party.active ? "success" : "secondary"}>
                    {party.active ? "Aktif" : "Pasif"}
                  </Badge>
                  {party.accountKind ? (
                    <Badge variant="outline">{party.accountKind}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {address || "Adres girilmemiş"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-right shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                  {party.accountList || (isCustomer ? "Müşteri" : "Tedarikçi")}
                </p>
                <p className="mt-1 text-sm font-bold">{party.currency || "TL"}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="Cep / iletişim" value={party.mobile || party.contact} />
              <InfoRow label="Sabit telefon" value={party.landline} />
              <InfoRow label="E-posta" value={party.email} />
              <InfoRow label="Vergi no" value={party.taxNo} />
              <InfoRow label="Vergi dairesi" value={party.taxOffice} />
              <InfoRow label="TC" value={party.nationalId} />
              <InfoRow
                label="IBAN"
                value={party.iban ? formatIban(party.iban) : ""}
              />
              <InfoRow label="Hesap kodu" value={party.accountCode} />
              <InfoRow label="Personel" value={party.assignedPersonnel} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-white/80 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-bold">Finans özeti</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow
                label="Devir bakiye"
                value={
                  party.openingBalance
                    ? `${moneyTry(party.openingBalance)} ${party.openingBalanceType || ""}`.trim()
                    : "—"
                }
              />
              <InfoRow
                label="Borç limiti"
                value={party.creditLimit ? moneyTry(party.creditLimit) : "—"}
              />
              <InfoRow
                label="Vade"
                value={party.paymentTermDays ? `${party.paymentTermDays} gün` : "—"}
              />
              <InfoRow label="Satış fiyatı" value={party.salesPriceList} />
              <InfoRow label="Şube" value={party.branch} />
              <InfoRow label="Ödeme vergi no" value={party.paymentTaxNo} />
            </div>
            {party.notes ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                {party.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {relatives.length > 0 || guarantors.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {relatives.length > 0 ? (
            <Card className="border-none bg-white/80 shadow-sm">
              <CardContent className="p-6">
                <p className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Yakınları
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatives.map((row, i) => (
                    <div key={`${row.name}-${i}`} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold">{row.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{row.phone || "Telefon yok"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
          {guarantors.length > 0 ? (
            <Card className="border-none bg-white/80 shadow-sm">
              <CardContent className="p-6">
                <p className="mb-4 flex items-center gap-2 text-sm font-bold">
                  <Shield className="h-4 w-4 text-amber-700" />
                  Kefiller
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {guarantors.map((row, i) => (
                    <div key={`${row.name}-${i}`} className="rounded-xl bg-amber-50/70 px-3 py-2">
                      <p className="text-sm font-semibold">{row.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[row.phone, row.nationalId].filter(Boolean).join(" · ") || "Detay yok"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <p className="text-sm font-bold">Bu cariden işlem</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CanWrite resource="budget">
            <ActionCard
              icon={Banknote}
              title="Tahsilat al"
              hint="Kasa / bütçeye gelir yaz"
              tone="emerald"
              onClick={() => openCash("gelir")}
            />
            <ActionCard
              icon={Landmark}
              title="Ödeme yap"
              hint="Kasa / bütçeye gider yaz"
              tone="rose"
              onClick={() => openCash("gider")}
            />
          </CanWrite>
          <CanWrite resource="invoices">
            {isCustomer ? (
              <>
                <ActionCard
                  icon={Receipt}
                  title="Satış faturası"
                  hint="Bu müşteriye fatura kes"
                  tone="indigo"
                  onClick={() => openInvoice("sales")}
                />
                <ActionCard
                  icon={FileText}
                  title="Fiyat teklifi"
                  hint="Teklif belgesi oluştur"
                  tone="sky"
                  onClick={() => setSheet("quote")}
                />
                <ActionCard
                  icon={Receipt}
                  title="Peşin satış"
                  hint="Nakit satış belgesi"
                  tone="emerald"
                  onClick={() => openInvoice("cash_sale")}
                />
                <ActionCard
                  icon={Receipt}
                  title="İade faturası"
                  hint="Satış iadesi düzenle"
                  tone="amber"
                  onClick={() => openInvoice("return")}
                />
                <ActionCard
                  icon={ScrollText}
                  title="Çek / senet al"
                  hint="Müşteriden alınan evrak"
                  tone="amber"
                  onClick={() => setSheet("cheque")}
                />
              </>
            ) : (
              <>
                <ActionCard
                  icon={Receipt}
                  title="Alış faturası"
                  hint="Bu tedarikçiden fatura"
                  tone="indigo"
                  onClick={() => openInvoice("purchase")}
                />
                <ActionCard
                  icon={ScrollText}
                  title="Çek / senet ver"
                  hint="Tedarikçiye verilen evrak"
                  tone="amber"
                  onClick={() => setSheet("cheque")}
                />
              </>
            )}
          </CanWrite>
          <CanWrite resource="delivery_notes">
            <ActionCard
              icon={Truck}
              title={isCustomer ? "Sevk irsaliyesi" : "Mal kabul irsaliyesi"}
              hint={isCustomer ? "Mamul sevk et" : "Gelen malı kaydet"}
              tone="sky"
              onClick={() => setSheet("delivery")}
            />
          </CanWrite>
          {!isCustomer ? (
            <CanWrite resource="raw_material_orders">
              <ActionCard
                icon={PackagePlus}
                title="Hammadde talebi"
                hint="Bu tedarikçiden sipariş"
                tone="indigo"
                onClick={() => setSheet("rawMaterial")}
              />
            </CanWrite>
          ) : null}
        </div>
      </section>

      <PartyAccountPanel
        name={party.name}
        address={address || undefined}
        contact={contact || undefined}
        active={party.active}
        account={account}
        empty={empty}
        avgLabel={avgLabel}
        onIncome={() => openCash("gelir")}
        onExpense={() => openCash("gider")}
      />

      {isCustomer ? (
        <CustomerFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          editing={party as Customer}
          onSaved={onSaved}
        />
      ) : (
        <SupplierFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          editing={party as Supplier}
          onSaved={onSaved}
        />
      )}
      <InvoiceFormSheet
        open={sheet === "invoice"}
        onOpenChange={(open) => setSheet(open ? "invoice" : null)}
        defaultDocumentType={invoiceType}
        defaultParty={party.name}
        lockDocumentType
        lockParty
        onSaved={onSaved}
      />
      {isCustomer ? (
        <QuoteFormSheet
          open={sheet === "quote"}
          onOpenChange={(open) => setSheet(open ? "quote" : null)}
          defaultParty={party.name}
          lockParty
          onSaved={onSaved}
        />
      ) : null}
      <DeliveryNoteFormSheet
        open={sheet === "delivery"}
        onOpenChange={(open) => setSheet(open ? "delivery" : null)}
        lockParty
        prefill={{
          party: party.name,
          partyAddress: party.address,
          partyTaxNo: party.taxNo,
          partyCity: party.city,
          partyDistrict: party.district,
          kind: isCustomer ? "Satış" : "Alış",
        }}
        onSaved={() => onSaved()}
      />
      <ChequeNoteFormSheet
        open={sheet === "cheque"}
        onOpenChange={(open) => setSheet(open ? "cheque" : null)}
        defaultParty={party.name}
        defaultDirection={isCustomer ? "received" : "given"}
        lockParty
        onSaved={onSaved}
      />
      <BudgetCashFormSheet
        open={sheet === "cash"}
        onOpenChange={(open) => setSheet(open ? "cash" : null)}
        direction={cashDirection}
        defaultParty={party.name}
        lockParty
        categories={categories
          .filter((row) => row.direction === cashDirection)
          .map((row) => row.name)}
        onSaved={onSaved}
      />
      {!isCustomer ? (
        <RawMaterialOrderFormSheet
          open={sheet === "rawMaterial"}
          onOpenChange={(open) => setSheet(open ? "rawMaterial" : null)}
          defaultSupplier={party.name}
          lockSupplier
          onCreated={() => onSaved()}
        />
      ) : null}
    </div>
  );
}
