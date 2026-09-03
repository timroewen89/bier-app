# Hoe fini di da? bier app

Een zelfstandige single-page webapp (één HTML-bestand, geen dependencies) om de bierlijsten van de proefgroep te verkennen: filter op stijl, familie, brouwerij of proever, bekijk scores in de kaartweergave, vergelijk smaakprofielen en zie op het BBQ-tabblad welke bierstijlen bij welk vlees of welke vis van de barbecue passen — met aanraders uit de eigen lijsten. Het tabblad "Te proeven" houdt een referentielijst (meegeleverde klassiekers, of een eigen CSV zoals een festivalprogramma of top-100) tegen de vijf lijsten aan en laat zien welke bieren nog niemand heeft gehad.

## Gebruik

Open [`index.html`](index.html) in een browser — meer is er niet nodig. Alle data zit in het bestand zelf (embedded JSON) en er worden geen externe verbindingen gemaakt.

CSV-import (eigen lijsten en proeflijsten) accepteert zowel komma- als puntkomma-gescheiden bestanden en decimale komma's ("8,5"), zodat exports uit Nederlandse Excel direct werken.

## Data verversen

De bierdata zit als JSON in `index.html` gebakken. Verversen vanuit nieuwe Untappd-exports:

```
node tools/bouw-data.mjs <map-met-exports>
```

Zet in die map per persoon één bestand met de naam van die persoon (`tim.csv`, `peter.json`, … — hoofdletterongevoelig). Zowel de Untappd-exportkolommen (`beer_name`, `brewery_name`, `beer_type`, `beer_abv`, `rating_score`, `created_at`) als de kolommen van de in-app import (`bier`, `brouwerij`, `stijl`, `abv`, `eigen_cijfer`) worden herkend; komma- én puntkomma-gescheiden CSV's en decimale komma's werken. Meerdere check-ins van hetzelfde bier worden ontdubbeld (laatste wint). Personen zonder bestand behouden hun huidige lijst, dus een gedeeltelijke verversing kan ook. Het script schrijft de peildatum in het datablok en meldt nieuwe hoofdstijlen die nog geen familie hebben.

Controleer daarna met `node test/match.test.js` en `git diff --stat` voordat je pusht.

## Tests

De naamvergelijking van het "Te proeven"-tabblad heeft eigen tests, die de match-kern rechtstreeks uit `index.html` lichten:

```
node test/match.test.js
```

## Publiceren via GitHub Pages

Omdat het bestand `index.html` heet, kan de app direct via GitHub Pages worden geserveerd: ga naar **Settings → Pages**, kies de branch en de root als bron.
