"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchTable, type Column } from "@/components/shared/search-table";
import {
  REPORT_GROUPS,
  buildReport,
  reportLabel,
  type ReportId,
  type ReportsData,
} from "@/lib/reports";
import { downloadReportExcel, downloadReportPdf } from "@/lib/report-export";
import { cn } from "@/lib/utils";

const GROUP_META: Record<string, { icon: LucideIcon; tint: string; iconBg: string }> = {
  "Kâr Zarar": {
    icon: TrendingUp,
    tint: "text-emerald-700",
    iconBg: "bg-emerald-500/12 text-emerald-600",
  },
  "Müşteri / Tedarikçi": {
    icon: Building2,
    tint: "text-indigo-700",
    iconBg: "bg-indigo-500/12 text-indigo-600",
  },
  Borçlar: {
    icon: TrendingDown,
    tint: "text-rose-700",
    iconBg: "bg-rose-500/12 text-rose-600",
  },
  Alacaklar: {
    icon: Wallet,
    tint: "text-amber-700",
    iconBg: "bg-amber-500/12 text-amber-600",
  },
  "Para Analizi": {
    icon: Banknote,
    tint: "text-sky-700",
    iconBg: "bg-sky-500/12 text-sky-600",
  },
  "Kasa / Bütçe": {
    icon: Wallet,
    tint: "text-teal-700",
    iconBg: "bg-teal-500/12 text-teal-600",
  },
  "Evrak Analizi": {
    icon: FileText,
    tint: "text-violet-700",
    iconBg: "bg-violet-500/12 text-violet-600",
  },
};

export function ReportsWorkspace({ data }: { data: ReportsData }) {
  const [reportId, setReportId] = useState<ReportId>("top-sales-customers");
  const [productQuery, setProductQuery] = useState("");
  const [menuQuery, setMenuQuery] = useState("");

  const report = useMemo(
    () => buildReport(reportId, data, productQuery),
    [reportId, data, productQuery]
  );

  const groups = useMemo(() => {
    const needle = menuQuery.trim().toLocaleLowerCase("tr");
    if (!needle) return REPORT_GROUPS;
    return REPORT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLocaleLowerCase("tr").includes(needle) ||
          group.title.toLocaleLowerCase("tr").includes(needle)
      ),
    })).filter((group) => group.items.length > 0);
  }, [menuQuery]);

  const columns: Column<(typeof report.rows)[number]>[] = report.columns.map((col) => ({
    key: col.key,
    header: col.header,
    className: col.className,
    render: (row) => row[col.key] ?? "—",
  }));

  return (
    <div className="grid gap-6 xl:grid-cols-[19.5rem_minmax(0,1fr)]">
      <Card className="glass-card border-none h-fit xl:sticky xl:top-6 overflow-hidden">
        <div className="border-b border-white/40 bg-linear-to-br from-indigo-600/8 via-transparent to-blue-500/5 px-5 py-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
            Raporlar
          </p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Kategori seçin, tablo sağda açılır.
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 rounded-xl bg-white/90 pl-9"
              placeholder="Rapor ara…"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="max-h-[min(70vh,44rem)] space-y-5 overflow-y-auto p-3">
          {groups.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Eşleşen rapor yok</p>
          ) : (
            groups.map((group) => {
              const meta = GROUP_META[group.title];
              const Icon = meta?.icon ?? FileText;
              return (
                <div key={group.title}>
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        meta?.iconBg ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p
                      className={cn(
                        "text-[11px] font-black uppercase tracking-widest",
                        meta?.tint ?? "text-muted-foreground"
                      )}
                    >
                      {group.title}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active = reportId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setReportId(item.id)}
                          className={cn(
                            "relative flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-all duration-200",
                            active
                              ? "bg-linear-to-r from-indigo-600 to-blue-500 font-semibold text-white shadow-md shadow-indigo-500/15"
                              : "text-foreground/80 hover:translate-x-0.5 hover:bg-indigo-500/6 hover:text-indigo-700"
                          )}
                        >
                          {active ? (
                            <span className="absolute left-0 top-1/2 h-1/2 w-1 -translate-y-1/2 rounded-r-full bg-white/50" />
                          ) : null}
                          <span className="leading-snug">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-none min-w-0">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black tracking-tight">{reportLabel(reportId)}</p>
              <p className="text-sm text-muted-foreground">{report.rows.length} kayıt</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={report.rows.length === 0}
                onClick={() =>
                  downloadReportExcel(reportLabel(reportId), report.columns, report.rows)
                }
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={report.rows.length === 0}
                onClick={() =>
                  void downloadReportPdf(reportLabel(reportId), report.columns, report.rows)
                }
              >
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
          {reportId === "document-product-search" ? (
            <Input
              className="max-w-md rounded-xl"
              placeholder="Ürün veya mal adı ara…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
          ) : null}
          <SearchTable
            rows={report.rows}
            columns={columns}
            searchText={(row) => Object.values(row).join(" ")}
            empty={report.empty}
          />
        </CardContent>
      </Card>
    </div>
  );
}
