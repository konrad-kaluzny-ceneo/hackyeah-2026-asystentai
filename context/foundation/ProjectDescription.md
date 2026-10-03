Project Name: Asystent AI - intencje na bieżąco
Published: true
Problem:
```
Zmęczenie decyzyjne (decision fatigue) to stan, w którym po serii decyzji nasz mózg stopniowo traci zdolność do racjonalnej oceny opcji i samokontroli. Im więcej decyzji podejmujemy, tym większe ryzyko, że kolejne będą gorszej jakości.

Gdy jesteśmy w tym stanie:
- podejmujemy gorsze decyzje,
- mamy obniżoną samokontrolę,
- odczuwamy większy stres.

Podczas zakupów online zmęczenie decyzyjne jest jednym z głównych powodów, dla których rezygnujemy z zakupów, odwlekamy zakup albo wybieramy produkt, z którego później jesteśmy niezadowoleni.

Podczas przeciętnych zakupów musimy przeanalizować:
- cenę,
- opinie,
- parametry,
- markę,
- promocje,
- dostępność.

Po pewnym czasie koszt podjęcia decyzji staje się wyższy niż potencjalna korzyść z wyboru lepszej opcji zakupu.

Zamiast zwiększać pewność wyboru, kolejne informacje często zwiększają naszą niepewność.

Czasem ostatecznie dokonujemy losowego wyboru, tylko żeby zakończyć wysiłek poznawczy.
```

Solution:
```
Im łatwiejszy mamy wybór, tym życie jest prostsze i szczęśliwsze. Nie tylko nasze, ale również sklepu, który uzyska klienta zadowolonego z zakupu. 

A klient zadowolony, to klient powracający na kolejne zakupy.

Projekt "Asystent AI - intencje na bieżąco" prezentuje System oparty o Model Decyzyjny, który wychwytuje intencje użytkownika i na bieżąco proponuje pomoc.

Jedna z głównych funkcji - dynamiczne obliczanie zmęczenia zakupowego, frustracji i niepewności klienta.

Gdy system zauważy, że klient potrzebuje pomocy, automatycznie zaproponuje mu podsumowanie, sugestie lub rekomendację, która pomoże podjąć wybór.

Efekt?
-> Klient jest odciążony, podejmuje szybciej lepszą decyzje.
-> Sklep zyskuje zadowolonego klienta, który dokonał szybszego a przy tym świadomego zakupu.
```

What's done so far and goal of your project:
```
W 24 godziny stworzyliśmy przykładowy sklep online, który posiada katalog produktów z branży AGD.
Działa: wyszukiwanie, filtry, katry produktów i Box Asystenta proponujący rozwiązania dla użytkownika.

Model Decyzyjny (Jev) już wychwytuje dwa stany użytkownika - zmęczenie decyzyjne oraz frustrację spowodowaną brakiem wyników. W sytuacji gdy Jev nie poradzi sobie z podjęciem ostatecznej decyzji, wołany jest mocniejszy model podejmujący ostateczną decyzje, jak doradzić użytkownikowi.

Tech Stack: Next.js + Neon z PostgreSQL, sesja jest anonimowa.
```

Your video presentation (Public or Listed YouTube link): ToDo

Website (https://...): https://hackyeah-2026-asystentai.vercel.app/

Code Repository: https://github.com/konrad-kaluzny-ceneo/hackyeah-2026-asystentai

Instructions on how to open project:
```
Wejście: https://hackyeah-2026-asystentai.vercel.app/katalog

Zmęczenie wyborem: wejdź w jedną kategorię, otwórz trzy produkty o podobnych parametrach, wróć na listę. Nad listingiem pojawi się jedna podpowiedź z przejściem do filtrów.

Puste wyniki: w kategorii wpisz frazę albo ustaw filtry tak, żeby lista była pusta. Podpowiedź czyści wyszukiwanie i filtry.

Zamknięcie krzyżykiem chowa podpowiedzi na 15 minut w tej karcie przeglądarki.
```

Presentation: ToDo