"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/shared/form-sheet";

export function PersonField({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Çalışan seçin",
  emptyHint = "Personel kaydında çalışan yok. Personel ekranından ekleyin.",
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyHint?: string;
}) {
  const selected = options.includes(value) ? value : undefined;
  return (
    <FormField
      label={label}
      htmlFor={id}
      required
      hint="Personel listesinden seçin. Yeni kişi Personel ekranından eklenir."
    >
      {options.length > 0 ? (
        <Select value={selected} onValueChange={onChange}>
          <SelectTrigger id={id} className="bg-white">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {emptyHint}
        </p>
      )}
    </FormField>
  );
}
