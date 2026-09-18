import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.documentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName: "HamdPharma",
      legalTitle: "HamdPharma İlaç San. ve Tic. Ltd. Şti.",
      taxOffice: "Kadıköy",
      taxNo: "1234567890",
      mersisNo: "0123456789012345",
      tradeRegister: "İstanbul / 123456",
      address: "Organize Sanayi Bölgesi, 1. Cadde No: 12",
      city: "İstanbul",
      district: "Pendik",
      phone: "0216 000 00 00",
      email: "info@hamdpharma.com",
      website: "www.hamdpharma.com",
      iban: "TR12 0000 0000 0000 0000 0000 00",
      bankName: "Ziraat Bankası Pendik Şubesi",
      authorizedName: "Muhasebe",
      footerNote: "Bu belge elektronik ortamda oluşturulmuştur.",
      showLogo: true,
    },
    update: {
      legalTitle: "HamdPharma İlaç San. ve Tic. Ltd. Şti.",
      taxOffice: "Kadıköy",
      taxNo: "1234567890",
      address: "Organize Sanayi Bölgesi, 1. Cadde No: 12",
      city: "İstanbul",
      district: "Pendik",
      phone: "0216 000 00 00",
      email: "info@hamdpharma.com",
      authorizedName: "Muhasebe",
      iban: "TR12 0000 0000 0000 0000 0000 00",
      bankName: "Ziraat Bankası Pendik Şubesi",
    },
  });

  let customer = await prisma.customer.findFirst({ where: { active: true } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        id: `cus-sample-${Date.now()}`,
        name: "Anadolu Eczanesi",
        contact: "Ayşe Demir",
        address: "Bağdat Cad. No: 45 Kadıköy / İstanbul",
        taxNo: "1111111111",
        email: "anadolu@ornek.eczane",
        active: true,
      },
    });
  }

  let supplier = await prisma.supplier.findFirst({ where: { active: true } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        id: `sup-sample-${Date.now()}`,
        name: "Marmara Kimya A.Ş.",
        contact: "Mehmet Kaya",
        address: "Hadımköy Sanayi Sitesi İstanbul",
        taxNo: "2222222222",
        taxOffice: "Hadımköy",
        email: "siparis@marmarakimya.ornek",
        active: true,
      },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const seller = {
    sellerName: "HamdPharma İlaç San. ve Tic. Ltd. Şti.",
    sellerTaxNo: "1234567890",
    sellerTaxOffice: "Kadıköy",
    sellerAddress: "Organize Sanayi Bölgesi, 1. Cadde No: 12 Pendik / İstanbul",
  };

  async function ensureInvoice(input: {
    invoiceNo: string;
    party: string;
    kind: string;
    documentType: string;
    bucket: string;
    confirmed: boolean;
    status: string;
    eDocument: string;
    dueDate: string;
    paymentMethod: string;
    notes: string;
    validUntil?: string;
    deliveryTerm?: string;
    preparedBy?: string;
    partyTaxNo: string;
    partyAddress: string;
    amount: number;
    subtotal: number;
    totalVat: number;
    lines: {
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      vatRate: number;
      lineNet: number;
      vatAmount: number;
      lineTotal: number;
    }[];
  }) {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNo: input.invoiceNo },
    });
    if (existing) return;
    await prisma.invoice.create({
      data: {
        id: `inv-${input.invoiceNo}`,
        invoiceNo: input.invoiceNo,
        party: input.party,
        kind: input.kind,
        issueDate: today,
        dueDate: input.dueDate,
        amount: input.amount,
        status: input.status,
        documentType: input.documentType,
        bucket: input.bucket,
        confirmed: input.confirmed,
        eDocument: input.eDocument,
        scenario: input.documentType === "quote" ? "TEKLIF" : "TEMELFATURA",
        currency: "TRY",
        fxRate: 1,
        partyTaxNo: input.partyTaxNo,
        partyAddress: input.partyAddress,
        partyCity: "İstanbul",
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        validUntil: input.validUntil ?? "",
        deliveryTerm: input.deliveryTerm ?? "",
        preparedBy: input.preparedBy ?? "",
        subtotal: input.subtotal,
        totalVat: input.totalVat,
        ...seller,
      },
    });
    await prisma.invoiceLine.createMany({
      data: input.lines.map((line, i) => ({
        id: `inl-${input.invoiceNo}-${i}`,
        invoiceNo: input.invoiceNo,
        description: line.description,
        quantityLabel: `${line.quantity} ${line.unit}`,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        discountRate: 0,
        vatRate: line.vatRate,
        lineNet: line.lineNet,
        vatAmount: line.vatAmount,
        lineTotal: line.lineTotal,
      })),
    });
  }

  await ensureInvoice({
    invoiceNo: "SAT-2026-0001",
    party: customer.name,
    kind: "Satış",
    documentType: "sales",
    bucket: "income",
    confirmed: true,
    status: "Ödenmedi",
    eDocument: "e-Arşiv",
    dueDate: until,
    paymentMethod: "Cari hesap",
    notes: "Örnek satış faturası.",
    partyTaxNo: customer.taxNo,
    partyAddress: customer.address,
    subtotal: 10000,
    totalVat: 2000,
    amount: 12000,
    lines: [
      {
        description: "Paracetamol 500 mg tablet 20'li kutu",
        quantity: 200,
        unit: "Kutu",
        unitPrice: 50,
        vatRate: 20,
        lineNet: 10000,
        vatAmount: 2000,
        lineTotal: 12000,
      },
    ],
  });

  await ensureInvoice({
    invoiceNo: "ALS-2026-0001",
    party: supplier.name,
    kind: "Alış",
    documentType: "purchase",
    bucket: "expense",
    confirmed: true,
    status: "Ödenmedi",
    eDocument: "e-Fatura",
    dueDate: until,
    paymentMethod: "Havale / EFT",
    notes: "Örnek alış faturası.",
    partyTaxNo: supplier.taxNo,
    partyAddress: supplier.address,
    subtotal: 25000,
    totalVat: 2500,
    amount: 27500,
    lines: [
      {
        description: "Etanol 96% farmasötik 200 L",
        quantity: 5,
        unit: "Adet",
        unitPrice: 5000,
        vatRate: 10,
        lineNet: 25000,
        vatAmount: 2500,
        lineTotal: 27500,
      },
    ],
  });

  await ensureInvoice({
    invoiceNo: "PRF-2026-0001",
    party: customer.name,
    kind: "Proforma",
    documentType: "proforma",
    bucket: "proforma",
    confirmed: false,
    status: "Proforma",
    eDocument: "Proforma",
    dueDate: until,
    paymentMethod: "Cari hesap",
    notes: "Kesinleşmemiş proforma faturadır.",
    partyTaxNo: customer.taxNo,
    partyAddress: customer.address,
    subtotal: 4800,
    totalVat: 960,
    amount: 5760,
    lines: [
      {
        description: "Vitamin C efervesan 20 tablet",
        quantity: 120,
        unit: "Kutu",
        unitPrice: 40,
        vatRate: 20,
        lineNet: 4800,
        vatAmount: 960,
        lineTotal: 5760,
      },
    ],
  });

  await ensureInvoice({
    invoiceNo: "TKF-2026-0001",
    party: customer.name,
    kind: "Fiyat teklifi",
    documentType: "quote",
    bucket: "proforma",
    confirmed: false,
    status: "Gönderildi",
    eDocument: "Proforma",
    dueDate: until,
    validUntil: until,
    deliveryTerm: "Siparişten sonra 7 iş günü / depodan teslim",
    preparedBy: "Satış",
    paymentMethod: "Cari hesap",
    notes:
      "Fiyatlar KDV hariçtir. Teklif, geçerlilik tarihine kadar geçerlidir. Stok durumuna göre teslim süresi değişebilir.",
    partyTaxNo: customer.taxNo,
    partyAddress: customer.address,
    subtotal: 15000,
    totalVat: 3000,
    amount: 18000,
    lines: [
      {
        description: "HamdPharma soğuk algınlığı şurubu 100 mL",
        quantity: 300,
        unit: "Adet",
        unitPrice: 50,
        vatRate: 20,
        lineNet: 15000,
        vatAmount: 3000,
        lineTotal: 18000,
      },
    ],
  });

  const existingNote = await prisma.deliveryNote.findUnique({
    where: { noteNo: "IRS-2026-0001" },
  });
  if (!existingNote) {
    await prisma.deliveryNote.create({
      data: {
        id: "dn-IRS-2026-0001",
        noteNo: "IRS-2026-0001",
        party: customer.name,
        kind: "Satış",
        issueDate: today,
        shipDate: today,
        warehouse: "Merkez depo",
        relatedOrderNo: "SIP-2026-014",
        relatedInvoiceNo: "SAT-2026-0001",
        status: "Sevk edildi",
        partyTaxNo: customer.taxNo,
        partyAddress: customer.address,
        partyCity: "İstanbul",
        driverName: "Hasan Yılmaz",
        plateNo: "34 HP 126",
        packages: "12 koli",
        notes: "Teslimatta soğuk zincir korunacaktır.",
      },
    });
    await prisma.deliveryNoteLine.createMany({
      data: [
        {
          id: "dnl-IRS-2026-0001-0",
          noteNo: "IRS-2026-0001",
          description: "Paracetamol 500 mg tablet 20'li kutu",
          quantityLabel: "200",
          unit: "Kutu",
        },
        {
          id: "dnl-IRS-2026-0001-1",
          noteNo: "IRS-2026-0001",
          description: "HamdPharma soğuk algınlığı şurubu 100 mL",
          quantityLabel: "40",
          unit: "Adet",
        },
      ],
    });
  }

  console.log("Örnek fatura, fiyat teklifi ve sevk irsaliyesi hazır.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
