import Link from "next/link";

export function CatalogUnavailable() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-subtle">Katalog chwilowo niedostępny</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-catalog-primary">Nie możemy teraz wczytać produktów</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        Spróbuj ponownie za chwilę. Jeśli problem się powtarza, sprawdź połączenie aplikacji z bazą danych.
      </p>
      <Link href="/" className="mt-6 rounded-xl bg-catalog-primary px-5 py-3 text-sm font-semibold text-white hover:bg-catalog-primary-hover">
        Wróć na stronę główną
      </Link>
    </main>
  );
}
