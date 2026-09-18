"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BudgetCalendarItem } from "@/lib/budget-cash";
import { sourceLabel } from "@/lib/budget-cash";
import { addDaysIso, cn, formatNumber, parseLocalDate, plusMonthsIso, todayIso } from "@/lib/utils";

type RangeFilter = "1" | "3" | "7" | "month";
type KindFilter = "all" | "gider" | "gelir";

const RANGE_FILTERS: { value: RangeFilter; label: string }[] = [
  { value: "1", label: "1 gün" },
  { value: "3", label: "3 gün" },
  { value: "7", label: "7 gün" },
  { value: "month", label: "Ay" },
];

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "gider", label: "Ödemeler" },
  { value: "gelir", label: "Tahsilatlar" },
];

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function rangeDays(start: string, range: Exclude<RangeFilter, "month">) {
  const count = Number(range);
  return Array.from({ length: count }, (_, i) => addDaysIso(start, i));
}

function formatRangeTitle(start: string, range: RangeFilter) {
  if (range === "month") {
    return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
      parseLocalDate(`${monthKey(start)}-01`)
    );
  }
  const days = rangeDays(start, range);
  const first = parseLocalDate(days[0]);
  const last = parseLocalDate(days[days.length - 1]);
  if (days.length === 1) {
    return new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(first);
  }
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const left = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: sameMonth ? undefined : "long",
  }).format(first);
  const right = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(last);
  return `${left} – ${right}`;
}

function monthCells(start: string) {
  const key = monthKey(start);
  const first = parseLocalDate(`${key}-01`);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${key}-${pad2(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function itemsByDate(items: BudgetCalendarItem[]) {
  const map = new Map<string, BudgetCalendarItem[]>();
  for (const row of items) {
    const key = row.date.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function EventChip({ row }: { row: BudgetCalendarItem }) {
  const pay = row.direction === "gider";
  return (
    <div
      className={cn(
        "rounded-lg px-2 py-1.5 text-left text-white shadow-sm",
        pay ? "bg-rose-500" : "bg-emerald-600"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold">{row.party}</span>
        <span className="shrink-0 text-[11px] font-bold">{formatNumber(row.amount)} ₺</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-white/80">
        {sourceLabel(row.source)}
        {row.title ? ` · ${row.title}` : ""}
      </p>
    </div>
  );
}

function DayColumn({
  iso,
  rows,
  today,
}: {
  iso: string;
  rows: BudgetCalendarItem[];
  today: string;
}) {
  const date = parseLocalDate(iso);
  const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(date);
  const isToday = iso === today;
  const payCount = rows.filter((row) => row.direction === "gider").length;
  const takeCount = rows.filter((row) => row.direction === "gelir").length;

  return (
    <section className="flex min-h-112 min-w-48 flex-1 flex-col border-r last:border-r-0">
      <header
        className={cn(
          "sticky top-0 z-10 border-b bg-background/95 px-3 py-3 backdrop-blur",
          isToday && "bg-indigo-50/90"
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {weekday}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-lg font-black",
              isToday ? "bg-indigo-600 text-white" : "text-foreground"
            )}
          >
            {date.getDate()}
          </span>
          <div className="text-[11px] text-muted-foreground">
            {payCount > 0 ? <div>{payCount} ödeme</div> : null}
            {takeCount > 0 ? <div>{takeCount} tahsilat</div> : null}
            {rows.length === 0 ? <div>Kayıt yok</div> : null}
          </div>
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {rows.map((row) => (
          <EventChip key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

export function BudgetCalendar({ items }: { items: BudgetCalendarItem[] }) {
  const today = todayIso();
  const [start, setStart] = useState(today);
  const [range, setRange] = useState<RangeFilter>("3");
  const [kind, setKind] = useState<KindFilter>("all");

  const filtered = useMemo(
    () => (kind === "all" ? items : items.filter((row) => row.direction === kind)),
    [items, kind]
  );
  const grouped = useMemo(() => itemsByDate(filtered), [filtered]);

  const days = range === "month" ? [] : rangeDays(start, range);
  const cells = range === "month" ? monthCells(start) : [];

  function shift(direction: -1 | 1) {
    if (range === "month") {
      setStart(plusMonthsIso(`${monthKey(start)}-01`, direction));
      return;
    }
    setStart(addDaysIso(start, direction * Number(range)));
  }

  function selectDay(iso: string) {
    setStart(iso);
    setRange("3");
  }

  const visible = range === "month" ? filtered.filter((row) => monthKey(row.date) === monthKey(start)) : days.flatMap((iso) => grouped.get(iso) ?? []);
  const payTotal = visible.filter((row) => row.direction === "gider").reduce((s, r) => s + r.amount, 0);
  const takeTotal = visible.filter((row) => row.direction === "gelir").reduce((s, r) => s + r.amount, 0);

  return (
    <Card className="glass-card overflow-hidden border-none">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setStart(today)}>
            Bugün
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shift(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-black capitalize tracking-tight">
            {formatRangeTitle(start, range)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-muted/70 p-1">
            {RANGE_FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={range === item.value ? "default" : "ghost"}
                className="h-8 rounded-lg px-3"
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex rounded-xl bg-muted/70 p-1">
            {KIND_FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={kind === item.value ? "default" : "ghost"}
                className="h-8 rounded-lg px-3"
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          Ödeme {formatNumber(payTotal)} ₺
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          Tahsilat {formatNumber(takeTotal)} ₺
        </span>
        <span>{visible.length} kayıt</span>
      </div>

      <CardContent className="p-0">
        {range === "month" ? (
          <div className="p-3">
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 overflow-hidden rounded-2xl border">
              {cells.map((iso, i) => {
                if (!iso) {
                  return <div key={`empty-${i}`} className="min-h-24 bg-muted/20" />;
                }
                const rows = grouped.get(iso) ?? [];
                const isToday = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => selectDay(iso)}
                    className={cn(
                      "min-h-24 border-b border-r p-2 text-left last:border-r-0 hover:bg-muted/40",
                      isToday && "bg-indigo-50"
                    )}
                  >
                    <span
                      className={cn(
                        "mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold",
                        isToday ? "bg-indigo-600 text-white" : "text-foreground"
                      )}
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                    <div className="space-y-1">
                      {rows.slice(0, 2).map((row) => (
                        <div
                          key={row.id}
                          className={cn(
                            "truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white",
                            row.direction === "gider" ? "bg-rose-500" : "bg-emerald-600"
                          )}
                        >
                          {row.party}
                        </div>
                      ))}
                      {rows.length > 2 ? (
                        <p className="text-[10px] font-semibold text-muted-foreground">
                          +{rows.length - 2} kayıt
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex overflow-x-auto">
            {days.map((iso) => (
              <DayColumn key={iso} iso={iso} rows={grouped.get(iso) ?? []} today={today} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
