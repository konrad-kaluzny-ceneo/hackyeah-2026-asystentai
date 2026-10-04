import Link from "next/link";

export function CatalogUnavailable() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-purple-700">Katalog chwilowo niedostępny</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#181126]">Nie możemy teraz wczytać produktów</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#6b617a]">
        Spróbuj ponownie za chwilę. Jeśli problem się powtarza, sprawdź połączenie aplikacji z bazą danych.
      </p>
      <Link href="/" className="mt-6 rounded-xl bg-gradient-to-r from-purple-700 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:from-purple-800 hover:to-purple-700 active:scale-[0.98]">
        Wróć na stronę główną
      </Link>
    </main>
  );
}
