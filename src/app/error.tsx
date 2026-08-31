"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({
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
    <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3">
        HamdPharma
      </p>
      <h1 className="text-3xl font-black tracking-tight">Bir şeyler ters gitti</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        Uygulama yüklenirken bir hata oluştu. Sayfayı yeniden deneyin.
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
