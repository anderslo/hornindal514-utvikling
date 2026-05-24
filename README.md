# Hornindal514 Utvikling — nettside

Enkelt statisk nettstad for Hornindal514 Utvikling AS (under skiping).

**Live på:** https://anderslo.github.io/hornindal514-utvikling/

Sida er bygd som éin HTML-fil med vanleg CSS — ingen byggeprosess, ingen
JavaScript-rammeverk. Lett å vedlikehalde og raskt å laste i nettlesaren.

## Filer

```
.
├── index.html       # Heile sida (single page)
├── styles.css       # All styling
├── README.md        # Denne fila
└── assets/
    ├── logo-emblem.svg                    # Rund emblem til venstre i headeren
    ├── logo-mark.png                      # Lite HORNINDAL514-merke
    ├── logo-utvikling.png                 # HORNINDAL514 + UTVIKLING i Candara Bold
    ├── logo-utvikling-800.png             # Same, 800 px (SoMe / OG)
    ├── logo-utvikling-h120.png            # Same, 120 px høgde (header-versjon)
    ├── hero-hornindalsvatnet.jpg          # Hero: utsikt frå kajakk på vatnet
    ├── hero-hornindalsvatnet-mobile.jpg   # Same, mobil-versjon
    ├── interimstyret.jpg                  # Gruppefoto av interimsstyret
    ├── skipingsmote.jpg                   # Frå skipingsmøtet på Smia
    ├── favicon.ico
    ├── favicon-32.png
    ├── favicon-256.png
    └── apple-touch-icon.png
```

## Sjå sida lokalt

Opn `index.html` direkte i nettlesaren, eller start ein enkel server:

```bash
python3 -m http.server 8000
```

…og opn `http://localhost:8000` i nettlesaren.

## Endre innhald

All tekst ligg direkte i `index.html`. Vanlege endringar:

- **Kontakt­info:** søk etter `kontakt`-seksjonen
- **Styremedlemar:** søk etter `<ul class="people">`
- **Satsingsområde:** søk etter `<section id="satsing"`
- **Partnarar:** søk etter `<ul class="partners">`
- **Manifest / visjon:** søk etter `class="manifesto-quote"`
- **Ord-rulle i hero:** søk etter `hero-marquee-track`

## Publisering

Sida er sett opp med GitHub Pages frå `main`-branchen. Endringar som blir
pusha til `main` er live innan ca. 1 minutt.

### Kople til hornindal514.no

Når DNS for `hornindal514.no` er klart:

1. I GitHub-repo → *Settings* → *Pages* → *Custom domain*: skriv
   `hornindal514.no` og lagre. Det opprettar ei fil `CNAME` automatisk.
2. Hos domeneleverandøren, legg til DNS-postar som peikar mot GitHub:
   - **A-postar** for rota (`@`) til GitHub sine IP-ar:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - **CNAME-post** for `www` som peikar til `anderslo.github.io`.
3. Vent på DNS-propagasjon (5–60 min). Skru på *Enforce HTTPS* i GitHub
   Pages-innstillingane.

## Vidare arbeid

- [ ] Erstatte initial-avatarane på styret med ekte portrettbilete
- [ ] Eige "Nyhende"- eller "Aktuelt"-seksjon for oppdateringar
- [ ] Logo i SVG-format (vektor) for skarpare gjengjeving i alle storleikar
- [ ] Engelsk versjon for tilflyttarar/bedrifter utanfor Norge
