"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SearchTable, type Column } from "@/components/shared/search-table";
import type { FinishedProduct } from "@/data/catalog";
import { fetchProducts } from "@/lib/catalog-store";
import { formatDate, formatNumber } from "@/lib/utils";

const columns: Column<FinishedProduct>[] = [
  { key: "sku", header: "SKU", className: "font-mono text-sm", render: (r) => r.sku },
  { key: "name", header: "Ürün Adı", render: (r) => r.name },
  {
    key: "quantity",
    header: "Miktar",
    className: "text-right font-bold",
    render: (r) => `${formatNumber(r.quantity ?? 0)} ${r.unit}`,
  },
  { key: "lotNo", header: "Parti / Batch", className: "font-mono text-sm", render: (r) => r.lotNo || "—" },
  { key: "warehouse", header: "Depo", render: (r) => r.warehouse ?? "—" },
  { key: "expiryDate", header: "STT", render: (r) => formatDate(r.expiryDate) },
];

export default function ProductsPage() {
  const [rows, setRows] = useState<FinishedProduct[]>([]);

  useEffect(() => {
    void fetchProducts().then(setRows);
  }, []);

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Üretim"
        title="Mamul Ürün"
        description="Elimizdeki hazır mamul. Sevk edilen ürünler listeden çıkar."
      />
      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <SearchTable
            rows={rows}
            columns={columns}
            searchText={(r) => `${r.sku} ${r.name} ${r.lotNo} ${r.warehouse ?? ""}`}
            empty="Hazır mamul yok. KK onaylanan ve henüz sevk edilmeyen partiler burada görünür."
          />
        </CardContent>
      </Card>
    </div>
  );
}
