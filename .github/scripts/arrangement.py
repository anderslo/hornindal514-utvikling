#!/usr/bin/env python3
"""Legg godkjende arrangement frå skjemaet inn i kva-skjer.html og kalender.ics.

Les den publiserte CSV-en (fana «Publisert», sjå lag-skjema.gs). Arrangementa
som er skrivne for hand, blir ikkje rørte. Skriptet eig berre dei det sjølv
har laga: li-ar med data-skjema og VEVENT-ar med UID som byrjar på skjema-.

  python3 .github/scripts/arrangement.py            hentar CSV_URL eller $SKJEMA_CSV
  python3 .github/scripts/arrangement.py --csv FIL  les ei lokal fil
  python3 .github/scripts/arrangement.py --sjekk    sjølvtest, rører ikkje repoet
"""
import argparse, csv, hashlib, html, io, os, re, sys, tempfile, urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTVyQFnPn3_x2uQyMTJT3gDIXKXcwyqsAhTivai7eSof9nHmfKbia19B65vtoGeH_r-kGdjHuQGGjqT/pub?gid=1270189586&single=true&output=csv"  # fana «Publisert», publisert på nettet som CSV
OSLO = ZoneInfo("Europe/Oslo")
ROT = Path(__file__).resolve().parents[2]
SIDE = "https://anderslo.github.io/hornindal514-utvikling/kva-skjer.html"
FELT = "id tittel dato til start slutt stad arrangor lenkje omtale regel".split()
START, SLUTT = "        <!-- kalender:start -->", "        <!-- kalender:slutt -->"
VEKEDAG = "må. ty. on. to. fr. la. sø.".split()
MANAD = "jan. feb. mars apr. mai juni juli aug. sep. okt. nov. des.".split()


# --- CSV -------------------------------------------------------------------

def dato(s):
    for f in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s.strip(), f).date()
        except ValueError:
            pass


def klokke(s):
    m = re.fullmatch(r"(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?", s.strip())
    if m and int(m[1]) < 24 and int(m[2]) < 60:
        return time(int(m[1]), int(m[2]))


def lenkje(s):
    """Berre vanlege nettlenkjer slepp gjennom. javascript: o.l. blir forkasta."""
    s = s.strip()
    if re.fullmatch(r"(?!/)[^\s:]*\.[^\s:]*", s):
        s = "https://" + s
    return s if re.fullmatch(r"https?://\S+", s, re.I) else ""


def ei_linje(s):
    return " ".join(s.split())


def les_csv(tekst, i_dag=None):
    """Gir liste med arrangement (dict). Kastar ValueError om dette ikkje er CSV-en vår."""
    rader = list(csv.reader(io.StringIO(tekst.lstrip("\ufeff"), newline="")))
    if rader and rader[0] and rader[0][0].strip() == "#N/A":
        return []
    overskrift = [c.strip().lower() for c in rader[0]] if rader else []
    if not set(FELT) <= set(overskrift):
        raise ValueError("fann ikkje overskriftsrada i CSV-en")
    ut = []
    for r in rader[1:]:
        if not any(c.strip() for c in r):
            continue
        f = {k: (r[i].strip() if i < len(r) else "") for i, k in enumerate(overskrift)}
        d, til = dato(f["dato"]), dato(f["til"])
        if not f["tittel"] or not d:
            print(f"Hoppar over rad utan tittel eller lesbar dato: {f['tittel'][:40]!r}", file=sys.stderr)
            continue
        if til and til <= d:
            til = None
        siste = til or d
        if i_dag and siste < i_dag:
            continue
        ut.append(dict(
            ident=f["id"], tittel=ei_linje(f["tittel"]), dato=d, til=til, siste=siste,
            start=klokke(f["start"]), slutt=klokke(f["slutt"]),
            stad=ei_linje(f["stad"]), arr=ei_linje(f["arrangor"]), lenkje=lenkje(f["lenkje"]),
            omtale=[l.strip() for l in f["omtale"].splitlines() if l.strip()],
            regel=ei_linje(f["regel"])))
    return ut


# --- HTML ------------------------------------------------------------------

def kl(t):
    return str(t.hour) if t.minute == 0 else f"{t.hour}.{t.minute:02d}"


def li_html(a):
    e = lambda s: html.escape(s, quote=True)
    d, s = a["dato"], a["siste"]
    if d == s:
        vd, dag, man = VEKEDAG[d.weekday()], str(d.day), MANAD[d.month - 1]
    else:
        vd = f"{VEKEDAG[d.weekday()]}-{VEKEDAG[s.weekday()]}"
        dag = f"{d.day}-{s.day}"
        man = MANAD[d.month - 1] + ("" if d.month == s.month else "-" + MANAD[s.month - 1])
    tittel = e(a["tittel"])
    if a["lenkje"]:
        tittel = f'<a href="{e(a["lenkje"])}" target="_blank" rel="noopener noreferrer">{tittel}</a>'
    tid = ""
    if a["start"]:
        tid = "Kl. " + kl(a["start"]) + (f"-{kl(a['slutt'])}" if a["slutt"] else "")
    meta = " · ".join(e(x) for x in (tid, a["stad"], a["arr"]) if x)
    L = [f'          <li data-slutt="{s.isoformat()}" data-skjema>',
         f'            <time datetime="{d.isoformat()}"><span>{vd}</span><span class="agenda-dag">{dag}</span><span>{man}</span></time>',
         '            <div>', f'              <h4>{tittel}</h4>']
    if meta:
        L.append(f'              <p class="agenda-meta">{meta}</p>')
    if a["omtale"]:
        L.append("              <p>" + "<br />".join(e(l) for l in a["omtale"]) + "</p>")
    if a["regel"]:
        L.append(f'              <p class="agenda-regel">Kvart år: {e(a["regel"])}</p>')
    return "\n".join(L + ["            </div>", "          </li>"])


def ny_html(tekst, arr):
    i, j = tekst.index(START), tekst.index(SLUTT) + len(SLUTT)
    delar = []  # (sorteringsnøkkel, tekst)
    for n, m in enumerate(re.finditer(r"<li\b.*?</li>", tekst[i:j], re.S)):
        if re.match(r"<li\b[^>]*\bdata-skjema\b", m[0]):
            continue
        dt = re.search(r'<time datetime="(\d{4}-\d\d-\d\d)"', m[0])[1]
        delar.append(((dt, 0, "", n), "          " + m[0]))
    for n, a in enumerate(arr):
        delar.append(((a["dato"].isoformat(), 1, str(a["start"] or ""), n), li_html(a)))
    delar.sort(key=lambda x: x[0])
    ut = [START]
    for ar in sorted({k[0][:4] for k, _ in delar}):
        if len(ut) > 1:
            ut.append("")
        ut += [f'        <h3 class="agenda-ar">{ar}</h3>', '        <ol class="agenda">']
        ut += [t for k, t in delar if k[0][:4] == ar]
        ut.append("        </ol>")
    return tekst[:i] + "\n".join(ut + [SLUTT]) + tekst[j:]


# --- ICS -------------------------------------------------------------------

def esc(s):
    return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def brett(linje):
    """Maks 75 oktettar per linje, aldri midt i eit teikn."""
    ut, cur = [], ""
    for ch in linje:
        if len((cur + ch).encode()) > 75:
            ut.append(cur)
            cur = " "
        cur += ch
    return "\r\n".join(ut + [cur])


def utc(d, t):
    return datetime.combine(d, t, OSLO).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def vevent(a):
    try:
        lokal = datetime.strptime(a["ident"], "%Y-%m-%d %H:%M:%S")
        uid, stempel = lokal.strftime("%Y%m%dT%H%M%S"), utc(lokal.date(), lokal.time())
    except ValueError:
        uid = hashlib.sha1((a["ident"] + a["tittel"]).encode()).hexdigest()[:12]
        stempel = "20261030T000000Z"  # fast, elles endrar fila seg kvar time
    d, s = a["dato"], a["siste"]
    if not a["start"] or (a["til"] and not a["slutt"]):
        tid = [f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{s + timedelta(days=1):%Y%m%d}"]
    else:
        tid = [f"DTSTART:{utc(d, a['start'])}"]
        if a["slutt"]:
            slutt = datetime.combine(s, a["slutt"])
            if slutt <= datetime.combine(d, a["start"]):
                slutt += timedelta(days=1)
            tid.append(f"DTEND:{utc(slutt.date(), slutt.time())}")
    beskr = [esc("\n".join(a["omtale"]))] * bool(a["omtale"])
    beskr += [esc("Kvart år: " + a["regel"])] * bool(a["regel"]) + [esc("Arrangør: " + a["arr"])] * bool(a["arr"])
    L = ["BEGIN:VEVENT", f"UID:skjema-{uid}@hornindal514-utvikling", f"DTSTAMP:{stempel}"] + tid
    L.append("SUMMARY:" + esc(a["tittel"]))
    if a["stad"]:
        L.append("LOCATION:" + esc(a["stad"]))
    if beskr:
        L.append("DESCRIPTION:" + "\\n".join(beskr))
    L += ["URL:" + (a["lenkje"] or SIDE), "END:VEVENT"]
    return "".join(brett(l) + "\r\n" for l in L)


def ny_ics(tekst, arr):
    tekst = re.sub(r"BEGIN:VEVENT\r\nUID:skjema-.*?END:VEVENT\r\n", "", tekst, flags=re.S)
    i = tekst.rindex("END:VCALENDAR")
    ny = "".join(vevent(a) for a in sorted(arr, key=lambda a: (a["dato"], a["start"] or time(0))))
    return tekst[:i] + ny + tekst[i:]


# --- Køyring ---------------------------------------------------------------

def kjor(rot, csv_tekst, i_dag):
    """Oppdaterer filene i rot. Gir lista over filer som endra seg. Feilar før noko blir skrive."""
    arr = les_csv(csv_tekst, i_dag)
    ut = []
    for namn, f in (("kva-skjer.html", ny_html), ("kalender.ics", ny_ics)):
        sti = Path(rot) / namn
        gammal = sti.read_bytes().decode("utf-8")  # bytes, så CRLF held seg
        ny = f(gammal, arr)
        if ny != gammal:
            ut.append((sti, ny))
    for sti, ny in ut:
        sti.write_bytes(ny.encode("utf-8"))
    return [s.name for s, _ in ut]


def sjekk():
    kopi = Path(tempfile.mkdtemp())
    for n in ("kva-skjer.html", "kalender.ics"):
        (kopi / n).write_bytes((ROT / n).read_bytes())
    orig = {n: (kopi / n).read_bytes() for n in ("kva-skjer.html", "kalender.ics")}
    lest = lambda n: (kopi / n).read_bytes().decode("utf-8")
    i_dag = date(2026, 10, 31)
    hode = ",".join(FELT) + "\n"
    tom = hode
    lang = "Ø" * 40 + ", " + "å" * 40
    csv_ = hode + "\n".join([
        '2026-10-30 23:15:12,Juleverkstad,2027-07-16,2027-07-18,,,Grodås,Laget,,,',
        '2026-10-29 10:00:00,"<b>&</b> Konsert",2026-11-20,,18:30,21:00,Smia,Kyrkjelyden,javascript:alert(1),'
        f'"Første linje\nAndre; linje {lang}",første helga i august',
        '2026-10-28 09:00:00,Sommarkveld,20.07.2027,,10.00,12:00,,,example.no/sommar,,',
        '2026-10-27 09:00:00,I går,2026-10-30,,,,,,,,',
        ',Utan dato,ikkje-ei-dato,,,,,,,,']) + "\n"

    assert les_csv("#N/A") == []
    try:
        les_csv("<html>Feil</html>")
        raise SystemExit("HTML-feilside skulle ha gitt feil")
    except ValueError:
        pass

    # 1. Tom CSV: byte-like filer
    assert kjor(kopi, tom, i_dag) == []
    assert all((kopi / n).read_bytes() == b for n, b in orig.items())

    # 2. Tre arrangement (pluss eitt med klokkeslett i juli)
    assert sorted(kjor(kopi, csv_, i_dag)) == ["kalender.ics", "kva-skjer.html"]
    h = lest("kva-skjer.html")
    assert ">I går<" not in h and ">Utan dato<" not in h
    assert "alert(1)" not in h and "&lt;b&gt;&amp;&lt;/b&gt; Konsert" in h and "<b>&</b>" not in h
    assert '<h4><a href="https://example.no/sommar"' in h
    datoar = re.findall(r'<time datetime="([\d-]+)"', h[h.index(START):h.index(SLUTT)])
    assert datoar == sorted(datoar), "kalenderen skal vere sortert"
    assert h.index("Konsert") < h.index('class="agenda-ar">2027') < h.index("Juleverkstad")
    assert '<span>fr.-sø.</span><span class="agenda-dag">16-18</span><span>juli</span>' in h
    assert "Kl. 18.30-21 · Smia · Kyrkjelyden" in h and "Første linje<br />Andre; linje" in h
    assert "Kvart år: første helga i august" in h

    # 3. Same CSV ein gong til: ingen endring. Tom CSV: originalen er tilbake
    assert kjor(kopi, csv_, i_dag) == []
    assert sorted(kjor(kopi, tom, i_dag)) == ["kalender.ics", "kva-skjer.html"]
    assert all((kopi / n).read_bytes() == b for n, b in orig.items())

    # 4. ICS
    kjor(kopi, csv_, i_dag)
    r = (kopi / "kalender.ics").read_bytes()
    assert r.count(b"\n") == r.count(b"\r\n") and all(len(l) <= 75 for l in r.split(b"\r\n"))
    t = r.decode("utf-8").replace("\r\n ", "")
    assert "DTSTART:20261120T173000Z" in t and "DTEND:20261120T200000Z" in t  # vintertid
    assert "DTSTART:20270720T080000Z" in t  # sommartid
    assert "DTSTART;VALUE=DATE:20270716" in t and "DTEND;VALUE=DATE:20270719" in t
    assert "UID:skjema-20261029T100000@" in t and "DTSTAMP:20261029T090000Z" in t
    assert "Andre\\; linje" in t and lang.replace(",", "\\,") in t
    assert t.count("URL:" + SIDE) >= 2 and "alert(1)" not in t
    print("Sjølvtesten gjekk gjennom")


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--csv", help="les ei lokal CSV-fil")
    p.add_argument("--sjekk", action="store_true", help="køyr sjølvtesten")
    a = p.parse_args()
    if a.sjekk:
        return sjekk()
    try:
        if a.csv:
            tekst = Path(a.csv).read_text(encoding="utf-8-sig")
        else:
            url = os.environ.get("SKJEMA_CSV") or CSV_URL
            if not url:
                return print("Ingen CSV-adresse (CSV_URL eller $SKJEMA_CSV). Ingen endringar.")
            if not url.startswith("https://"):
                raise ValueError("CSV-adressa må byrje med https://")
            with urllib.request.urlopen(url, timeout=30) as svar:
                tekst = svar.read().decode("utf-8-sig")
        endra = kjor(ROT, tekst, datetime.now(OSLO).date())
    except Exception as e:
        sys.exit(f"Feil: {e}")
    print("Endra: " + ", ".join(endra) if endra else "Ingen endringar.")


if __name__ == "__main__":
    main()
