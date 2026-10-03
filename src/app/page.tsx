import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <p className="text-sm font-medium text-zinc-500">Hackathon MVP · szkielet</p>
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Asystent AI — intencje na bieżąco
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Kupujący AGD przegląda wiele produktów o podobnych parametrach i nie
          podejmuje decyzji. Szkielet demo jest uruchomiony: sesja anonimowa,
          pusta trasa katalogu i miejsce na co najwyżej jedną propozycję
          następnego kroku.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        <li>Bez logowania i bez akcji na koszyku.</li>
        <li>Katalog nie emituje jeszcze faktów zakupowych.</li>
        <li>Klasyfikacja intencji i propozycja asystenta nie są jeszcze zbudowane.</li>
      </ul>
      <Link
        href="/katalog"
        className="inline-flex h-12 w-fit items-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
      >
        Otwórz demo katalogu
      </Link>
    </main>
  );
}
