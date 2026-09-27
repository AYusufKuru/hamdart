"use client";

import { PageHeader } from "@/components/shared/page-header";
import { QuotesWorkspace } from "@/components/catalog/quotes-workspace";

export default function QuotesPage() {
  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Satış"
        title="Fiyat teklifi"
        description="Müşteriye özel teklifler. PDF olarak indirilebilir."
      />
      <QuotesWorkspace />
    </div>
  );
}
