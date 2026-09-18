"use client";

import { Paperclip } from "lucide-react";
import type { InvoiceEvent } from "@/data/catalog";

export function InvoiceFileLinks({ files }: { files: InvoiceEvent[] }) {
  if (files.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex max-w-52 flex-col items-start gap-1">
      {files.map((file) => (
        <a
          key={file.fileId}
          href={`/api/invoice-docs/${file.fileId}`}
          target="_blank"
          rel="noreferrer"
          title={file.fileName || "Dekont"}
          className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-indigo-600 underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.fileName || "Dekont"}</span>
        </a>
      ))}
    </div>
  );
}
