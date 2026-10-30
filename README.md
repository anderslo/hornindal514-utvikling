# Hornindal 514 Utvikling - nettside

Enkel statisk nettstad for Hornindal 514 Utvikling AS.

**Live på:** https://anderslo.github.io/hornindal514-utvikling/

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
├── styles.css                # All styling
├── README.md                 # Denne fila
├── assets/                   # Bilete og favikon
└── .github/
    ├── scripts/
    │   ├── arrangement.py    # Legg godkjende arrangement frå skjemaet inn i kalenderen (berre standardbiblioteket)
    │   └── lag-skjema.gs     # Lagar Google-skjemaet og reknearket (køyrast ein gong på script.google.com)
    └── workflows/
        └── arrangement.yml   # Køyrer arrangement.py kvar time og pushar om noko har endra seg
```

## Kalenderen har to kjelder

- **Handskrivne arrangement.** Står i `kva-skjer.html` og `kalender.ics` og blir
  redigerte for hand, som før.
- **Arrangement frå skjemaet.** Folk melder inn i eit Google-skjema, og
  arrangement.py legg dei godkjende inn mellom `kalender:start` og
  `kalender:slutt` i `kva-skjer.html` (merkte `data-skjema`) og i
  `kalender.ics` (`UID:skjema-`). Skriptet eig desse, så dei skal ikkje
  redigerast for hand. Rett i reknearket i staden. Handskrivne arrangement
  innanfor markørane blir ikkje rørte.

CSV-adressa står i `CSV_URL` øvst i arrangement.py. Test utan nettverk med
`python3 .github/scripts/arrangement.py --csv fil.csv`, og køyr sjølvtesten med
`--sjekk`.
