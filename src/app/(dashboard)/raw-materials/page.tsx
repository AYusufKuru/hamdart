"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rawMaterials } from "@/data/raw-materials";
import { formatMoney } from "@/lib/recipe-calculations";
import { Beaker, Search } from "lucide-react";

const categoryVariant = {
  "Ham Madde": "info" as const,
  Eksipiyan: "secondary" as const,
  Ambalaj: "warning" as const,
  Diğer: "secondary" as const,
};

export default function RawMaterialsPage() {
  const [search, setSearch] = useState("");

  const filtered = rawMaterials.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Maliyet"
        badgeClassName="bg-amber-500/10 text-amber-700 border-amber-500/20"
        title="Hammadde Tablosu"
        description="Reçete maliyet hesapları bu tablodaki birim maliyetlerden çekilir. Tedarik süreci için Hammadde Siparişleri sayfasına gidin."
        actions={
          <Button className="rounded-2xl" variant="outline" asChild>
            <Link href="/raw-material-orders">Hammadde Siparişleri</Link>
          </Button>
        }
      />

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="relative max-w-md mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Malzeme veya SKU ara..."
              className="pl-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Malzeme</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    <Badge variant={categoryVariant[m.category]}>
                      {m.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatMoney(m.unitCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Beaker className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Malzeme bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pb-10" />
    </div>
  );
}
