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
      <body className="min-h-full flex flex-col bg-[#faf8fd] text-[#181126]">
        <div className="border-b border-purple-900/40 bg-gradient-to-r from-[#240e4a] via-[#3b126d] to-[#240e4a] px-4 py-2 text-center text-xs font-medium tracking-wide text-purple-100 shadow-xs">
          DEMO KATALOGU AGD <span className="px-2 text-purple-300/50">·</span> wybierz sprzęt w swoim tempie
        </div>
        <SiteHeader categories={categories} />
        <CatalogSessionTracker />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mt-16 border-t border-purple-100 bg-white/70 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-5 py-8 text-sm text-[#6b617a] sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <Link href="/" className="font-semibold tracking-tight text-[#240e4a]">dobre<span className="text-[#7c3aed]">.</span>agd</Link>
            <p>Katalog demonstracyjny · przykładowe modele i parametry</p>
          </div>
        </footer>
        <BehaviorDebugShell />
      </body>
    </html>
  );
}
