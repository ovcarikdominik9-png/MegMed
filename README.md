# MegMed

Riadiaca vrstva štúdia na iPad. Odpovedá na tri otázky: **čo sa mám dnes učiť**, **čo už mám zvládnuté** a **čo horí**.
Poznámky sú v CollaNote, kvízy v NotebookLM – MegMed len plánuje a sleduje pokrok.

Čistá webová appka (HTML, CSS, JavaScript bez frameworku a bez build kroku), PWA, funguje offline, dáta iba v zariadení (IndexedDB).

## Štruktúra

```
index.html, manifest.webmanifest, sw.js   – appka, PWA manifest, offline cache
css/app.css                               – vzhľad
js/app.js                                 – štart, navigácia
js/db.js                                  – IndexedDB, export/import zálohy, migrácie
js/store.js                               – stav a akcie
js/plan.js                                – pravidlo „Dnes“ (čisté funkcie)
js/dates.js, js/util.js                   – dátumy a pomocné funkcie
js/ui/                                    – dialógy, dlhé podržanie, ťahanie
js/views/                                 – obrazovky
tests/                                    – testy pravidla „Dnes“
tools/serve.py                            – lokálny server na testovanie
```

## Pravidlo „Dnes“ (js/plan.js)

Pre každý predmet so skúškou dnes alebo neskôr:

1. Zostávajúce kroky témy: Nezačaté 3, Prejdené 2, Zopakované 1, Zvládnuté 0.
2. Dni = od dneška (vrátane) do dňa pred skúškou, minimálne 1.
3. Dnešný cieľ = zostávajúce kroky predmetu / dni, zaokrúhlené nahor.
4. Kroky sa rozdelia: najprv Zopakované, potom Prejdené, potom Nezačaté (v poradí zoznamu). Každá téma dostane najprv 1 krok; ak cieľ ešte nie je naplnený, ďalšie kroky sa pridajú v rovnakom poradí (téma „×2“).
5. Plán sa počíta zo stavu tém na začiatku dňa, takže sa počas dňa nemení.
6. Do skúšky 7 dní a menej → upozornenie. Bližšia skúška = vyššie v zozname.

## Testovanie na Macu

```bash
python3 tools/serve.py
```

- Appka: http://localhost:8090
- Testy pravidla „Dnes“: http://localhost:8090/tests/index.html (alebo `node tests/run-node.mjs`, ak máš Node.js)
- Offline cache sa na localhoste zapína až s `?sw`: http://localhost:8090/?sw

## Nová verzia

Po každej zmene súborov zvýš `VERSION` v `sw.js` (napr. `megmed-v2`), commitni a pushni. iPad si novú verziu stiahne pri ďalšom otvorení appky s internetom (appka sa raz sama obnoví).

## Dátový model (verzia schémy 1)

- `subjects`: id, name, color, examDate (YYYY-MM-DD), examTime, startDate, order
- `groups`: id, subjectId, name, order (okruhy)
- `topics`: id, subjectId, groupId, title, note, status 0–3, order, statusChangedAt, `reviews` (rezervované pre opakovanie v odstupoch vo verzii 2)
- `events`: id, title, date, time, subjectId (ručné termíny)
- `log`: každá zmena stavu {topicId, subjectId, from, to, day, at} – z neho sa počíta dnešný pokrok, týždeň, heatmapa a vo verzii 2 aj opakovanie po 3, 7 a 21 dňoch
- `settings`: lastBackupAt
