"use client";

import { useMemo, useState } from "react";
import type { WarehouseStockItem } from "@/data/warehouses";
import { getWarehouseName, WAREHOUSE_IDS } from "@/data/warehouses";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search, Snowflake } from "lucide-react";

const PAGE_SIZE = 15;

const statusMap = {
  normal: { label: "Normal", variant: "success" as const },
  low: { label: "Düşük", variant: "warning" as const },
  critical: { label: "Kritik", variant: "danger" as const },
  expiring: { label: "SKT Yakın", variant: "warning" as const },
};

interface WarehouseStockTableProps {
  items: WarehouseStockItem[];
  warehouseId: string;
  categories: string[];
}

export function WarehouseStockTable({
  items,
  warehouseId,
  categories,
}: WarehouseStockTableProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.lotNo.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      const matchesCategory =
        category === "all" || item.category === category;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, category, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const isLab = warehouseId === WAREHOUSE_IDS.laboratory;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Ürün, SKU, lot veya kategori ara..."
            className="pl-10 rounded-xl"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="rounded-xl border bg-background px-3 py-2 text-sm min-w-[140px]"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border bg-background px-3 py-2 text-sm min-w-[130px]"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Tüm durumlar</option>
          <option value="normal">Normal</option>
          <option value="low">Düşük</option>
          <option value="critical">Kritik</option>
          <option value="expiring">SKT Yakın</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong>{filtered.length}</strong> kalem listeleniyor
        {filtered.length !== items.length && ` (${items.length} toplam)`}
      </p>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Ürün / Malzeme Adı</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Miktar</TableHead>
              <TableHead>Lot No-Parti</TableHead>
              <TableHead>Son Kullanma Tarihi</TableHead>
              {isLab && <TableHead>Kaynak</TableHead>}
              <TableHead>Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item) => {
              const st = statusMap[item.status] ?? {
                label: item.status,
                variant: "secondary" as const,
              };
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-bold">
                    {item.sku}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-[220px]">
                      {item.temperature && (
                        <Snowflake className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      <span className="font-medium truncate">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {item.category}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-bold",
                        item.status === "critical" && "text-rose-600",
                        item.status === "low" && "text-amber-600"
                      )}
                    >
                      {item.quantity.toLocaleString("tr-TR", {
                        maximumFractionDigits: 4,
                      })}{" "}
                      {item.unit}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Min: {formatNumber(item.minStock)}
                      {item.labTargetQuantity !== undefined &&
                        ` · Hedef: ${item.labTargetQuantity} ${item.unit}`}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.lotNo}</TableCell>
                  <TableCell
                    className={cn(
                      "text-sm",
                      item.status === "expiring" && "text-amber-600 font-semibold"
                    )}
                  >
                    {formatDate(item.expiryDate)}
                  </TableCell>
                  {isLab && (
                    <TableCell className="text-xs">
                      {item.labDirectEntry ? (
                        <Badge variant="warning">Doğrudan lab</Badge>
                      ) : item.replenishFromWarehouseId ? (
                        <span className="text-muted-foreground">
                          {getWarehouseName(item.replenishFromWarehouseId)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {paginated.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          Filtrelere uygun ürün bulunamadı.
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Sayfa {safePage} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
