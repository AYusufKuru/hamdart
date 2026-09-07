"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
};

export function SearchTable<T extends { id: string }>({
  rows,
  columns,
  searchText,
  pageSize = 20,
  empty = "Kayıt bulunamadı",
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  pageSize?: number;
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return rows;
    return rows.filter((row) =>
      searchText(row).toLocaleLowerCase("tr").includes(needle)
    );
  }, [rows, q, searchText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Ara..."
          className="pl-10 rounded-xl"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.className}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((row) => (
            <TableRow
              key={row.id}
              className={onRowClick ? "cursor-pointer hover:bg-muted/40" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={c.className}>
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">{empty}</p>
      )}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filtered.length} kayıt · sayfa {safePage}/{totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
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
