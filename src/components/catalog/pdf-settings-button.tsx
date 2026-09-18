"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfSettingsButton() {
  return (
    <Button asChild variant="outline" className="rounded-2xl">
      <Link href="/document-settings">
        <Settings className="mr-2 h-4 w-4" />
        PDF ayarları
      </Link>
    </Button>
  );
}
