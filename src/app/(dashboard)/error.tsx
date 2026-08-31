"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="p-10 min-h-[60vh] flex flex-col items-center justify-center text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
        HamdPharma
      </p>
      <h1 className="text-2xl font-black tracking-tight">Bir şeyler ters gitti</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        Bu ekran yüklenirken bir hata oluştu. Tekrar deneyebilir veya dashboard’a
        dönebilirsiniz.
      </p>
      <Button
        className="mt-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
        onClick={() => reset()}
      >
        Tekrar dene
      </Button>
    </div>
  );
}
