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
├── bedrifter.html            # Bedrifter i Hornindal: alle bedriftene (frå Einingsregisteret) og støttespelarane
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
  lag-skjema.gs), og arrangementet er ute etter om lag fem minutt. Det
  valfrie e-postfeltet blir aldri publisert, og adressa blir sletta dagen
  etter at arrangementet er over.

CSV-adressa står i `CSV_URL` øvst i arrangement.py. Test utan nettverk med
`python3 .github/scripts/arrangement.py --csv fil.csv`, og køyr sjølvtesten med
`--sjekk`. Han kontrollerer òg at `kva-skjer.html` og `kalender.ics` har dei
same arrangementa, på same dag og med same klokkeslett, så køyr han etter kvar
endring i kalenderen.

## Bedriftslista

Lista i `bedrifter.html` vart henta frå Brreg (Einingsregisteret) 14. november
2026 og blir sjekka éin gong i året. Filterreglane står i issue #3, med éi
endring: enkeltpersonføretak med forretningsnamn er med sjølv om dei ikkje er
MVA-registrerte.

Støttespelarane står tre stader: logobandet i `bedrifter.html`, lista i
`bidra.html` (`#stotte`) og teksten under økonomien på framsida. Endrar du éin,
endrar du alle. Testen `node .github/scripts/sjekk-bedrifter.mjs
http://localhost:8744` (med `python3 -m http.server 8744`) sjekkar sida.

Tala i snarvegane øvst på sida («12 bedrifter») står for hand i HTML-en. Legg du
til eller tek ut ei bedrift, rettar du talet, og testen seier frå om det ikkje
stemmer med lista. Kor stor ein logo er i logobandet, står i `width` og `height`
på biletet. Ein støttespelar utan logo får namnet sitt i
`<span class="logoband-namn">`.

## Stilarket har versjon

Alle sidene lenkjer til `styles.css?v=2`. Når du endrar `styles.css` saman med
HTML som treng dei nye reglane, aukar du talet på alle sidene. Elles får folk som
har vore innom før, ny HTML med det gamle stilarket frå nettlesaren i inntil ti
minutt, og sida ser øydelagd ut.

## Nyheitsbrevet

Påmeldinga på framsida (`#nyheitsbrev`) sender e-postadressa rett til skjemaet
«Påmelding til nyheitsbrevet» i HubSpot-kontoen til Hornindal 514 Utvikling
(portal 149669734, skjema `20b96a75-de49-42a4-a900-e7781d81a02e`), med samtykke
til abonnementstypen «Nyheitsbrev». Sida lastar ikkje noko frå HubSpot og set
ingen informasjonskapslar, slik personvernerklæringa lovar. Bruk difor ikkje
HubSpot sitt innebygde skjema-skript.
