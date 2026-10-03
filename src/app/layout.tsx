import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { BehaviorTracker } from "./behavior-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Asystent AI — intencje na bieżąco",
    template: "%s · Asystent AI",
  },
  description:
    "Szkielet demo katalogu AGD. Asystent ma proponować jeden następny krok na podstawie sygnałów przeglądania, bez logowania.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="text-sm font-medium">
              Asystent AI
            </Link>
            <nav>
              <Link
                href="/katalog"
                className="text-sm text-zinc-600 dark:text-zinc-400"
              >
                Demo katalogu
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <BehaviorTracker />
      </body>
    </html>
  );
}
