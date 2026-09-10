"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const MIN_COL_PX = 56;

const TableResizeContext = React.createContext(true);

export type TableSortDir = "asc" | "desc";
export type TableSortState = { column: number; dir: TableSortDir } | null;

type TableSortContextValue = {
  enabled: boolean;
  sort: TableSortState;
  toggle: (column: number) => void;
};

const TableSortContext = React.createContext<TableSortContextValue>({
  enabled: false,
  sort: null,
  toggle: () => {},
});

export function nextTableSort(
  current: TableSortState,
  column: number
): TableSortState {
  if (!current || current.column !== column) return { column, dir: "asc" };
  if (current.dir === "asc") return { column, dir: "desc" };
  return null;
}

export function collectSortText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim();
  }
  if (Array.isArray(node)) {
    return node.map(collectSortText).filter(Boolean).join(" ").trim();
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return collectSortText(props.children);
  }
  return "";
}

function parseDateMs(text: string): number | null {
  const t = text.trim();
  const dmy = t.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/);
  if (dmy) {
    const ms = Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return Number.isNaN(ms) ? null : ms;
  }
  const ymd = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const ms = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function parseSortNumber(text: string): number | null {
  const cleaned = text
    .replace(/[₺%]/g, "")
    .replace(/\bTL\b/gi, "")
    .trim();
  if (!cleaned || cleaned === "—") return null;
  const m = cleaned.match(
    /^(-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+,\d+|-?\d+(?:\.\d+)?)(?:\s*[a-zA-ZçğıöşüÇĞİÖŞÜ]+)?$/
  );
  if (!m?.[1]) return null;
  const raw = m[1];
  // tr-TR: 30.000 = 30000, 32.500,50 = 32500.50. Nokta binlik, virgül ondalık.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function compareSortText(a: string, b: string): number {
  const aEmpty = !a || a === "—";
  const bEmpty = !b || b === "—";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aDate = parseDateMs(a);
  const bDate = parseDateMs(b);
  if (aDate != null && bDate != null) return aDate - bDate;

  const aNum = parseSortNumber(a);
  const bNum = parseSortNumber(b);
  if (aNum != null && bNum != null) return aNum - bNum;

  return a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" });
}

export function sortCollection<T>(
  items: T[],
  sort: TableSortState,
  getText: (item: T, column: number) => string
): T[] {
  if (!sort) return items;
  return [...items].sort((a, b) => {
    const cmp = compareSortText(getText(a, sort.column), getText(b, sort.column));
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function rowCell(row: React.ReactNode, column: number): React.ReactNode {
  if (!React.isValidElement<{ children?: React.ReactNode }>(row)) return "";
  const cells = React.Children.toArray(row.props.children);
  return cells[column] ?? "";
}

function headerCells(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
}

function lockColumnWidths(table: HTMLTableElement) {
  if (table.dataset.colsLocked === "1") return;
  const heads = headerCells(table);
  const widths = heads.map((th) =>
    Math.max(MIN_COL_PX, Math.round(th.getBoundingClientRect().width))
  );
  heads.forEach((th, i) => {
    const isLast = i === heads.length - 1;
    const width = widths[i] ?? MIN_COL_PX;
    th.style.minWidth = `${width}px`;
    if (isLast) {
      th.style.width = "auto";
      th.style.maxWidth = "";
    } else {
      th.style.width = `${width}px`;
      th.style.maxWidth = `${width}px`;
    }
  });
  table.style.tableLayout = "fixed";
  table.style.width = "100%";
  table.style.minWidth = `${widths.reduce((sum, width) => sum + width, 0)}px`;
  table.dataset.colsLocked = "1";
}

function setColumnWidth(th: HTMLTableCellElement, width: number) {
  const table = th.closest("table");
  if (!table) return;
  const heads = headerCells(table);
  const isLast = heads.at(-1) === th;
  const next = Math.round(width);
  th.style.minWidth = `${next}px`;
  if (isLast) {
    th.style.width = "auto";
    th.style.maxWidth = "";
  } else {
    th.style.width = `${next}px`;
    th.style.maxWidth = `${next}px`;
  }
  const sum = heads.reduce((total, head) => {
    return total + (parseFloat(head.style.minWidth) || MIN_COL_PX);
  }, 0);
  table.style.width = "100%";
  table.style.minWidth = `${sum}px`;
}

function ColumnResizeHandle() {
  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const th = handle.closest("th");
    const table = th?.closest("table");
    if (!th || !table) return;

    lockColumnWidths(table);
    const startX = event.clientX;
    const startWidth = th.getBoundingClientRect().width;
    handle.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => {
      setColumnWidth(th, Math.max(MIN_COL_PX, startWidth + move.clientX - startX));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Sütun genişliğini ayarla"
      className="col-resize-handle group/resize absolute top-0 right-0 z-10 flex h-full w-3 cursor-col-resize items-center justify-center"
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="h-5 w-px rounded-full bg-border group-hover/resize:h-6 group-hover/resize:w-0.5 group-hover/resize:bg-indigo-400" />
    </button>
  );
}

function textFromNode(node: React.ReactNode): string | undefined {
  if (node == null || typeof node === "boolean") return undefined;
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node).trim();
    return text || undefined;
  }
  if (Array.isArray(node)) {
    const text = node.map(textFromNode).filter(Boolean).join(" ").trim();
    return text || undefined;
  }
  return undefined;
}

function useAutoTitle(
  ref: React.RefObject<HTMLElement | null>,
  children: React.ReactNode,
  explicit?: string
) {
  const [autoTitle, setAutoTitle] = React.useState<string | undefined>(() =>
    textFromNode(children)
  );

  React.useLayoutEffect(() => {
    if (explicit !== undefined) return;
    const fromChildren = textFromNode(children);
    if (fromChildren) {
      setAutoTitle(fromChildren);
      return;
    }
    const fromDom = ref.current?.innerText.replace(/\s+/g, " ").trim();
    setAutoTitle(fromDom || undefined);
  }, [children, explicit, ref]);

  if (explicit !== undefined) return explicit || undefined;
  return autoTitle;
}

function Table({
  className,
  resizable = true,
  sortable = true,
  sort: sortProp,
  onSortChange,
  ...props
}: React.ComponentProps<"table"> & {
  resizable?: boolean;
  sortable?: boolean;
  sort?: TableSortState;
  onSortChange?: (sort: TableSortState) => void;
}) {
  const [internalSort, setInternalSort] = React.useState<TableSortState>(null);
  const controlled = sortProp !== undefined;
  const sort = controlled ? sortProp : internalSort;

  const toggle = React.useCallback(
    (column: number) => {
      const next = nextTableSort(sort, column);
      onSortChange?.(next);
      if (!controlled) setInternalSort(next);
    },
    [sort, controlled, onSortChange]
  );

  const sortValue = React.useMemo(
    () => ({ enabled: sortable, sort, toggle }),
    [sortable, sort, toggle]
  );

  return (
    <TableResizeContext.Provider value={resizable}>
      <TableSortContext.Provider value={sortValue}>
        <div className="relative w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          <table
            className={cn("w-full table-fixed caption-bottom text-sm", className)}
            {...props}
          />
        </div>
      </TableSortContext.Provider>
    </TableResizeContext.Provider>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({
  className,
  children,
  ...props
}: React.ComponentProps<"tbody">) {
  const { enabled, sort } = React.useContext(TableSortContext);
  const rows = React.Children.toArray(children);
  const displayed =
    enabled && sort
      ? [...rows].sort((a, b) => {
          const cmp = compareSortText(
            collectSortText(rowCell(a, sort.column)),
            collectSortText(rowCell(b, sort.column))
          );
          return sort.dir === "asc" ? cmp : -cmp;
        })
      : rows;

  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
      {displayed}
    </tbody>
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/40 transition-colors hover:bg-muted/30",
        className
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  children,
  title,
  sortable: sortableProp,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<"th"> & { sortable?: boolean }) {
  const resizable = React.useContext(TableResizeContext);
  const { enabled, sort, toggle } = React.useContext(TableSortContext);
  const ref = React.useRef<HTMLTableCellElement>(null);
  const autoTitle = useAutoTitle(ref, children, title);
  const empty = !textFromNode(children);
  const canSort = enabled && (sortableProp ?? !empty);
  const [columnIndex, setColumnIndex] = React.useState(-1);

  React.useLayoutEffect(() => {
    const th = ref.current;
    const parent = th?.parentElement;
    if (!th || !parent) return;
    setColumnIndex(Array.from(parent.children).indexOf(th));
  });

  const active = canSort && sort != null && sort.column === columnIndex;
  const ariaSort = !canSort
    ? undefined
    : active
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : "none";

  function activate(event: React.SyntheticEvent) {
    if (!canSort) return;
    const th = event.currentTarget as HTMLTableCellElement;
    const parent = th.parentElement;
    if (!parent) return;
    const index = Array.from(parent.children).indexOf(th);
    if (index >= 0) toggle(index);
  }

  return (
    <th
      ref={ref}
      title={autoTitle}
      aria-sort={ariaSort}
      tabIndex={canSort ? 0 : undefined}
      className={cn(
        "relative h-11 overflow-hidden px-4 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap",
        canSort &&
          "cursor-pointer select-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        empty && "col-head-empty",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        activate(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !canSort) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(event);
        }
      }}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-1 pr-2">
        <span className="min-w-0 truncate">{children}</span>
        {canSort ? (
          <span
            className={cn(
              "shrink-0",
              active ? "text-indigo-600" : "text-muted-foreground/40"
            )}
          >
            {active && sort.dir === "asc" ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : active && sort.dir === "desc" ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
          </span>
        ) : null}
      </span>
      {resizable && !empty ? <ColumnResizeHandle /> : null}
    </th>
  );
}

function TableCell({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<"td">) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  const autoTitle = useAutoTitle(ref, children, title);

  return (
    <td
      ref={ref}
      title={autoTitle}
      className={cn(
        "max-w-0 overflow-hidden p-4 align-middle whitespace-nowrap text-ellipsis",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
