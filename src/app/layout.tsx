import type { Metadata } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { toAuthUser } from "@/lib/auth/user";
import { getLiveSessionFromCookies } from "@/lib/auth/live-session";
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
  // Sonucu kullanmak zorunlu: React Compiler kullanılmayan `await headers()`
  // çağrısını silebilir; sayfa önceden üretilir, CSP nonce binmez, script
  // bloklanır ve ekran "Yükleniyor"da kalır.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  let initialUser = null;
  try {
    const session = await getLiveSessionFromCookies();
    if (session) initialUser = toAuthUser(session);
  } catch {
    initialUser = null;
  }
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-nonce={nonce}
    >
      <body className="min-h-full min-w-0 w-full overflow-x-hidden flex flex-col font-sans">
        <Providers initialUser={initialUser}>{children}</Providers>
      </body>
    </html>
  );
}
