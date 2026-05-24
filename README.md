# Hornindal514 Utvikling — nettside

Enkelt statisk nettstad for Hornindal514 Utvikling AS (under skiping).

## Filer

```
site/
├── index.html       # Sjølve sida (single page)
├── styles.css       # All styling
├── README.md        # Denne fila
└── assets/
    ├── logo-mark.png                       # Lite Hornindal514-merke til header/footer
    ├── logo-utvikling.png                  # Full logo "HORNINDAL514" + "UTVIKLING" (Candara Bold)
    ├── logo-utvikling-800.png              # Same, men 800 px brei (for SoMe/OG)
    ├── hero-hornindalsvatnet.jpg           # Hero-bilete (1920 px)
    ├── hero-hornindalsvatnet-mobile.jpg    # Same, 960 px for mobil
    ├── skipingsmote.jpg                    # Bilete frå skipingsmøte på Smia
    ├── favicon.ico
    ├── favicon-32.png
    ├── favicon-256.png
    └── apple-touch-icon.png
```

## Bilete­kreditt og lisensar

- **Hero-bilete** (`hero-hornindalsvatnet.jpg`): «Hornindalsvatnet frå
  Fureneset, Stad, Vestland, Noreg, mai 2025». Henta frå
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hornindalsvatnet_from_Fureneset,_Stad,_Vestland,_Norway,_2025_May.jpg),
  CC BY-SA. Kreditt er lagt inn nedst i hero-seksjonen.
- **Skipingsmøte-bilete** (`skipingsmote.jpg`): frå `info/Bilde/` —
  eige materiell.
- **Logo «HORNINDAL514»**: eksisterande wordmark (frå familien som
  blir brukt av Hornindal514 Fotball / Dansegalla). «UTVIKLING» er
  sett i Candara Bold.

Sida er bygd som ein enkelt HTML-fil med vanleg CSS — ingen byggeprosess,
ingen JavaScript-rammeverk. Det gjer det enkelt å vedlikehalde og raskt å
laste i nettlesaren.

## Sjå sida lokalt

Opn `index.html` direkte i nettlesaren, eller start ein enkel server:

```bash
cd site
python3 -m http.server 8000
```

…og opn `http://localhost:8000` i nettlesaren.

## Publisere på GitHub Pages

1. **Lag eit GitHub-repo** (t.d. `hornindal514/website` eller liknande).
2. **Last opp innhaldet i `site/`** til rota av repoet (slik at
   `index.html` ligg i toppmappa).
3. **Aktiver GitHub Pages:**
   - Gå til repoet → *Settings* → *Pages*
   - Under *Source*, vel branch `main` og folder `/ (root)`
   - Lagre. Etter eit par minutt er sida tilgjengeleg på
     `https://<brukar-eller-org>.github.io/<repo-namn>/`

### Kople til hornindal514.no

Når du har fått tilgang til DNS for `hornindal514.no`:

1. I GitHub-repo → *Settings* → *Pages* → *Custom domain*:
   skriv `hornindal514.no` og lagre. Dette opprettar ei fil `CNAME`
   automatisk.
2. Hos domeneleverandøren, legg til DNS-postar som peikar mot GitHub:
   - **A-postar** for rota (`@`) til GitHub sine IP-ar:
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```
   - **CNAME-post** for `www` som peikar til `<brukar>.github.io`.
3. Vent på DNS-propagasjon (5–60 min). Skru på *Enforce HTTPS* i GitHub
   Pages-innstillingane.

## Endre innhald

All tekst ligg direkte i `index.html`. Vanlege endringar:

- **Kontakt-info:** søk etter `kontakt`-seksjonen
- **Styremedlemar:** søk etter `<ul class="people">`
- **Satsingsområde:** søk etter `<section id="satsing"`
- **Partnarar:** søk etter `<ul class="partners">`

## Vidare arbeid

Forslag til neste versjon når dei første tilbakemeldingane kjem inn:

- [ ] Erstatte initial-avatarane på styret med ekte portrettbilete
- [ ] Legge til eit reint landskapsbilete frå Hornindal som hero-bakgrunn
- [ ] Eige "Nyhende"- eller "Aktuelt"-seksjon for oppdateringar
- [ ] Logo i SVG-format (vektor) for skarpare gjengjeving i alle storleikar
- [ ] Engelsk versjon for tilflyttarar/bedrifter utanfor Norge
