import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { getCategories } from "@/lib/catalog-repository";
import type { Category } from "@/lib/catalog-types";
import { CatalogSessionTracker } from "@/components/assistant/catalog-session-tracker";
import SiteHeader from "@/components/site-header";
import { BehaviorDebugShell } from "./behavior-debug-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dobre AGD — wybór urządzeń do domu",
    template: "%s · Dobre AGD",
  },
  description:
    "Przejrzysty katalog sprzętów AGD z pomocą dopasowaną do tego, czego szukasz.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  let categories: Category[] = [];
  try {
    categories = await getCategories();
  } catch {
    // The page renders its own database-unavailable state; navigation stays usable.
  }

  return (
    <html lang="pl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="border-b border-[#e7ebe8] bg-[#193b35] px-4 py-2 text-center text-xs font-medium tracking-wide text-white/90">
          DEMO KATALOGU AGD <span className="px-2 text-white/45">·</span> wybierz sprzęt w swoim tempie
        </div>
        <BehaviorTracker />
        <SiteHeader categories={categories} />
        <CatalogSessionTracker />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mt-16 border-t border-[#e2e7e3] bg-white">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-5 py-8 text-sm text-[#697570] sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <Link href="/" className="font-semibold tracking-tight text-[#193b35]">dobre<span className="text-[#bd542e]">.</span>agd</Link>
            <p>Katalog demonstracyjny · przykładowe modele i parametry</p>
          </div>
        </footer>
<<<<<<< HEAD
=======
        <BehaviorDebugShell />
>>>>>>> origin/main
      </body>
    </html>
  );
}
