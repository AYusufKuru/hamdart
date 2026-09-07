"use client";



import { useEffect, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";

import { Card, CardContent } from "@/components/ui/card";

import { SearchTable, type Column } from "@/components/shared/search-table";

import type { FinishedProduct } from "@/data/catalog";

import { fetchProducts } from "@/lib/catalog-store";

import { formatDate } from "@/lib/utils";



const columns: Column<FinishedProduct>[] = [

  { key: "sku", header: "SKU", className: "font-mono text-sm", render: (r) => r.sku },

  { key: "name", header: "Ürün Adı", render: (r) => r.name },

  { key: "unit", header: "Birim", render: (r) => r.unit },

  { key: "minStock", header: "Min Stok", render: (r) => r.minStock || "—" },

  { key: "maxStock", header: "Max Stok", render: (r) => r.maxStock || "—" },

  { key: "lotNo", header: "Parti No", render: (r) => r.lotNo || "—" },

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

        description="Excel mamul ürün listesi."

      />

      <Card className="glass-card border-none">

        <CardContent className="p-6">

          <SearchTable

            rows={rows}

            columns={columns}

            searchText={(r) => `${r.sku} ${r.name} ${r.lotNo}`}

          />

        </CardContent>

      </Card>

    </div>

  );

}


