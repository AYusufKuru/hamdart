import personnelJson from "@/data/import/personnel.json";
import suppliersJson from "@/data/import/suppliers.json";
import customersJson from "@/data/import/customers.json";
import productsJson from "@/data/import/products.json";
import invoicesJson from "@/data/import/invoices.json";
import invoiceLinesJson from "@/data/import/invoice-lines.json";
import ledgerJson from "@/data/import/ledger.json";
import budgetJson from "@/data/import/budget.json";

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
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  address: string;
  taxNo: string;
  email: string;
  active: boolean;
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
}

export interface InvoiceLine {
  id: string;
  invoiceNo: string;
  description: string;
  quantityLabel: string;
  unitPrice: number;
  lineTotal: number;
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

export const seedPersonnel = personnelJson as Personnel[];
export const seedSuppliers = suppliersJson as Supplier[];
export const seedCustomers = customersJson as Customer[];
export const seedProducts = productsJson as FinishedProduct[];
export const seedInvoices = invoicesJson as Invoice[];
export const seedInvoiceLines = invoiceLinesJson as InvoiceLine[];
export const seedLedger = ledgerJson as LedgerEntry[];
export const seedBudget = budgetJson as BudgetRow[];
