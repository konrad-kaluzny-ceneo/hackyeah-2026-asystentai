import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Demo katalogu",
  description:
    "Pusta trasa demo katalogu AGD. Mock produktów i zdarzenia sygnałów powstaną w kolejnym slice.",
};

export default function KatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Trasa /katalog</p>
      <h1 className="text-3xl font-semibold tracking-tight">Demo katalogu</h1>
      <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        Tu kupujący będzie przeglądał mock produktów AGD. Na tym etapie jest
        tylko trasa: brak listy produktów, filtrów i zdarzeń zachowania.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
      >
        Wróć do opisu szkieletu
      </Link>
    </main>
  );
}
