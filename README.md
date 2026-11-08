# Hornindal 514 Utvikling - nettside

Enkel statisk nettstad for Hornindal 514 Utvikling AS.

**Live på:** https://hornindal514.no/

Sida er bygd med vanleg HTML og CSS, utan byggeprosess eller
JavaScript-rammeverk. Lett å vedlikehalde og raskt å laste i nettlesaren.

## Filer

```
.
├── index.html                # Framsida
├── flytt-til-hornindal.html  # Flytt hit
├── kva-skjer.html            # Kva skjer: kalender, faste tilbod og praktisk kvardag
├── kalender.ics              # Kalenderen som folk kan abonnere på (same arrangement som på kva-skjer.html)
├── frivillig.html            # Lag og frivillig arbeid
├── smia.html                 # Smia
├── bidra.html                # Landingssida for QR-koden på flygebladet: ope møte og interesseskjema (HubSpot)
├── personvern.html           # Personvernerklæring
├── 404.html                  # Visast når ei adresse ikkje finst (absolutte stiar)
├── robots.txt                # Opnar for alle søkjemotorar og peikar til sitemap.xml
├── sitemap.xml               # Sidene søkjemotorane skal finne: legg til nye sider her
├── google6d3dcbdc4ba0cc22.html # Stadfestar eigarskapen i Google Search Console: må ikkje slettast
├── styles.css                # All styling
├── README.md                 # Denne fila
├── assets/                   # Bilete og favikon
└── .github/
    ├── scripts/
    │   ├── arrangement.py    # Legg godkjende arrangement frå skjemaet inn i kalenderen (berre standardbiblioteket)
    │   └── lag-skjema.gs     # Lagar Google-skjemaet og reknearket, startar jobben når noko blir godkjent og varslar i Slack om nye (script.google.com)
    └── workflows/
        └── arrangement.yml   # Køyrer arrangement.py kvar time og når arket startar han, og pushar om noko har endra seg
```

## Kalenderen har to kjelder

- **Handskrivne arrangement.** Står i `kva-skjer.html` og `kalender.ics` og blir
  redigerte for hand, som før.
- **Arrangement frå skjemaet.** Folk melder inn i eit Google-skjema, og
  arrangement.py legg dei godkjende inn mellom `kalender:start` og
  `kalender:slutt` i `kva-skjer.html` (merkte `data-skjema`) og i
  `kalender.ics` (`UID:skjema-`). Skriptet eig desse, så dei skal ikkje
  redigerast for hand. Rett i reknearket i staden. Handskrivne arrangement
  innanfor markørane blir ikkje rørte. Når eit arrangement blir godkjent eller
  retta i arket, startar arket jobben med ein gong (oppsettet står i
  lag-skjema.gs), og arrangementet er ute etter om lag fem minutt.

CSV-adressa står i `CSV_URL` øvst i arrangement.py. Test utan nettverk med
`python3 .github/scripts/arrangement.py --csv fil.csv`, og køyr sjølvtesten med
`--sjekk`.

## Nyheitsbrevet

Påmeldinga på framsida (`#nyheitsbrev`) sender e-postadressa rett til skjemaet
«Påmelding til nyheitsbrevet» i HubSpot-kontoen til Hornindal 514 Utvikling
(portal 149669734, skjema `20b96a75-de49-42a4-a900-e7781d81a02e`), med samtykke
til abonnementstypen «Nyheitsbrev». Sida lastar ikkje noko frå HubSpot og set
ingen informasjonskapslar, slik personvernerklæringa lovar. Bruk difor ikkje
HubSpot sitt innebygde skjema-skript.
