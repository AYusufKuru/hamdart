"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

function matchesQuery(option: SearchableSelectOption, query: string) {
  const q = normalize(query);
  if (!q) return true;
  return normalize(`${option.label} ${option.keywords ?? ""}`).includes(q);
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Seçin",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç yok",
  disabled,
  className,
  id,
  allowCustom = false,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  allowCustom?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      if (!option.value) return false;
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [options]);
  const selected = uniqueOptions.find((o) => o.value === value);
  const display = selected?.label ?? (allowCustom ? value ?? "" : "");
  const filtered = useMemo(
    () => uniqueOptions.filter((o) => matchesQuery(o, query)),
    [uniqueOptions, query]
  );
  const customQuery = query.trim();
  const showCustom =
    allowCustom &&
    Boolean(customQuery) &&
    !uniqueOptions.some(
      (o) => o.value === customQuery || o.label === customQuery
    );

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function pick(next: string) {
    onValueChange(next);
    close();
    inputRef.current?.blur();
  }

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 240 && rect.top > 240);
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const hit = filtered[activeIndex];
      if (hit) {
        pick(hit.value);
        return;
      }
      if (allowCustom && query.trim()) pick(query.trim());
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          placeholder={open ? searchPlaceholder : placeholder}
          value={open ? query : display}
          onFocus={() => {
            if (disabled) return;
            setQuery(allowCustom ? value ?? "" : "");
            setOpen(true);
          }}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (allowCustom) onValueChange(next);
            if (!open) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-white py-2 pl-3 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Listeyi aç"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </div>
      {open ? (
        <div
          id={listId}
          role="listbox"
          data-hamdart-select-panel=""
          className={cn(
            "absolute z-50 max-h-60 w-full overflow-y-auto rounded-2xl border bg-white p-1 text-foreground shadow-xl",
            dropUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          )}
        >
          {filtered.length === 0 && !showCustom ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <>
              {showCustom ? (
                <div
                  role="option"
                  aria-selected={value === customQuery}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(customQuery);
                  }}
                  className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="line-clamp-2">“{customQuery}” olarak kullan</span>
                </div>
              ) : null}
              {filtered.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <div
                    key={`${option.value}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(option.value);
                    }}
                    className={cn(
                      "relative flex cursor-pointer items-center rounded-lg py-2 pl-8 pr-2 text-left text-sm hover:bg-muted",
                      isActive && "bg-muted"
                    )}
                  >
                    {isSelected ? <Check className="absolute left-2 h-4 w-4" /> : null}
                    <span className="line-clamp-2">{option.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
