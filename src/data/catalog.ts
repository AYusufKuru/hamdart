export interface Personnel {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  hireDate: string;
  salary: number | null;
  iban: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address: string;
  active: boolean;
  invoiceName: string;
  accountList: string;
  currency: string;
  accountCode: string;
  onlineTransactions: boolean;
  notes: string;
  iban: string;
  country: string;
  city: string;
  district: string;
  mobile: string;
  email: string;
  landline: string;
  accountKind: string;
  taxNo: string;
  taxOffice: string;
  nationalId: string;
  openingBalance: number;
  openingBalanceType: string;
  paymentTermDays: number;
  creditLimit: number;
  salesPriceList: string;
  branch: string;
  assignedPersonnel: string;
  paymentTaxNo: string;
  relatives: string;
  guarantors: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  taxNo: string;
  email: string;
  active: boolean;
  invoiceName: string;
  accountList: string;
  currency: string;
  accountCode: string;
  onlineTransactions: boolean;
  notes: string;
  iban: string;
  country: string;
  city: string;
  district: string;
  mobile: string;
  landline: string;
  accountKind: string;
  taxOffice: string;
  nationalId: string;
  openingBalance: number;
  openingBalanceType: string;
  paymentTermDays: number;
  creditLimit: number;
  salesPriceList: string;
  branch: string;
  assignedPersonnel: string;
  paymentTaxNo: string;
  relatives: string;
  guarantors: string;
}

export interface FinishedProduct {
  id: string;
  sku: string;
  name: string;
  unit: string;
  minStock: number;
  maxStock: number;
  lotNo: string;
  expiryDate: string;
  quantity?: number;
  warehouse?: string;
  status?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  party: string;
  kind: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: string;
  documentType: string;
  bucket: string;
  confirmed: boolean;
  eDocument: string;
  scenario: string;
  series: string;
  currency: string;
  fxRate: number;
  partyTaxNo: string;
  partyTaxOffice: string;
  partyAddress: string;
  partyCity: string;
  partyDistrict: string;
  partyPhone: string;
  partyEmail: string;
  sellerName: string;
  sellerTaxNo: string;
  sellerTaxOffice: string;
  sellerAddress: string;
  paymentMethod: string;
  relatedDispatchNo: string;
  relatedOrderNo: string;
  notes: string;
  validUntil: string;
  deliveryTerm: string;
  preparedBy: string;
  subtotal: number;
  totalDiscount: number;
  totalVat: number;
  withholding: number;
  paidAmount: number;
}

export interface InvoiceLine {
  id: string;
  invoiceNo: string;
  description: string;
  quantityLabel: string;
  unitPrice: number;
  lineTotal: number;
  quantity: number;
  unit: string;
  discountRate: number;
  vatRate: number;
  vatAmount: number;
  lineNet: number;
}

export interface InvoiceEvent {
  id: string;
  invoiceNo: string;
  kind: "status" | "payment";
  status: string;
  amount: number;
  method: string;
  note: string;
  fileName: string;
  fileId: string;
  mimeType: string;
  createdAt: string;
  createdBy: string;
}

export type ChequeKind = "cek" | "senet";
export type ChequeDirection = "received" | "given";
export type ChequeInstrumentStatus =
  | "Bekliyor"
  | "Onaylandı"
  | "Alındı"
  | "Karşılıksız"
  | "İptal";
export type ChequeInstallmentStatus = "Bekliyor" | "Faturada" | "Karşılıksız";

export interface ChequeNoteInstallment {
  id: string;
  chequeNoteId: string;
  sequence: number;
  dueDate: string;
  amount: number;
  serialNo: string;
  status: ChequeInstallmentStatus;
  paidAt: string;
  invoiceNo: string;
  paymentEventId: string;
}

export interface ChequeNote {
  id: string;
  docNo: string;
  kind: ChequeKind;
  direction: ChequeDirection;
  party: string;
  issueDate: string;
  bankName: string;
  serialNo: string;
  totalAmount: number;
  currency: string;
  status: ChequeInstrumentStatus;
  notes: string;
  relatedInvoiceNo: string;
  createdAt: string;
  createdBy: string;
  installments: ChequeNoteInstallment[];
}

export interface DeliveryNote {
  id: string;
  noteNo: string;
  party: string;
  kind: string;
  issueDate: string;
  shipDate: string;
  warehouse: string;
  relatedOrderNo: string;
  relatedInvoiceNo: string;
  status: string;
  partyTaxNo: string;
  partyAddress: string;
  partyCity: string;
  partyDistrict: string;
  partyCountry: string;
  partyPostalCode: string;
  driverName: string;
  driverNationalId: string;
  plateNo: string;
  trailerPlate: string;
  plateOrigin: string;
  shipMethod: string;
  dispatchAddress: string;
  issueTime: string;
  shipTime: string;
  relatedOrderDate: string;
  packages: string;
  notes: string;
}

export interface DocumentSettings {
  id: string;
  companyName: string;
  legalTitle: string;
  taxOffice: string;
  taxNo: string;
  mersisNo: string;
  tradeRegister: string;
  address: string;
  city: string;
  district: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bankName: string;
  authorizedName: string;
  footerNote: string;
  logoDataUrl: string;
  showLogo: boolean;
}

export interface DeliveryNoteLine {
  id: string;
  noteNo: string;
  description: string;
  quantityLabel: string;
  unit: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  documentNo: string;
  description: string;
  category: string;
  direction: string;
  amount: number;
  status: string;
}

export interface BudgetRow {
  id: string;
  department: string;
  annual: number;
  spent: number;
}

export type BudgetCashDirection = "gelir" | "gider";

export interface BudgetCategory {
  id: string;
  direction: BudgetCashDirection;
  name: string;
}

export interface BudgetCashEntry {
  id: string;
  direction: BudgetCashDirection;
  party: string;
  category: string;
  amount: number;
  date: string;
  dueDate: string;
  description: string;
  invoiceNo: string;
  cashAccountId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  documented: boolean;
  createdAt: string;
  createdBy: string;
}

