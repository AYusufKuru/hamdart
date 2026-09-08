import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

/** Nonce'lı CSP için her istekte sunucu tarafında render */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HamdPharma — İlaç Üretim Yönetim Sistemi",
  description: "Fabrika, stok, depo, sipariş ve Ar-Ge laboratuvarı yönetim paneli",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  // headers() okunmazsa Next 16 login'i önceden üretir (x-nextjs-prerender: 1);
  // CSP nonce her istekte değişir, script'ler bloklanır, sayfa Yükleniyor'da kalır.
  await headers();
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
