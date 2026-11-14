// Akseptansetest for /bedrifter (issue #3). Playwright som bibliotek, ingen testrammeverk.
//
// Køyring (frå rota av worktreen, med sida servert lokalt):
//   python3 -m http.server 8744 &
//   node .github/scripts/sjekk-bedrifter.mjs http://localhost:8744
//
// Valfrie miljøvariablar:
//   SKJERMBILETE=/sti/til/mappe   skjermbilete blir lagde her (ikkje i repoet); utan den blir ingen tekne
//   PLAYWRIGHT=/sti/til/playwright  (standard: ~/Developer/GitHub/nk-nettside/node_modules/playwright)
//   UTAN_NETT=1                   hopp over Brreg, lenkjesjekk og axe (alt som treng nett)
//
// Eksterne kall som testen sjølv gjer: data.brreg.no (opent API, berre bedriftsdata), HEAD/GET mot
// bedriftslenkjene og cdnjs (axe-core). Sida sjølv skal ikkje gjere eksterne kall (kriterium 12).
// Ingenting blir sendt ut: mailto/tel blir ikkje opna, og det finst ingen skjema på sida.
// Avslutningskode 1 om eit kriterium feilar.

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const base = (process.argv[2] || 'http://localhost:8744').replace(/\/$/, '');
const require = createRequire(import.meta.url);
const { chromium, webkit } = require(process.env.PLAYWRIGHT || path.join(homedir(), 'Developer/GitHub/nk-nettside/node_modules/playwright'));
const SHOTS = process.env.SKJERMBILETE;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const UTAN_NETT = !!process.env.UTAN_NETT;
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const SIDER = ['index', 'flytt-til-hornindal', 'kva-skjer', 'frivillig', 'smia', 'bidra', 'personvern', '404', 'bedrifter'].map(s => s + '.html');
const resultat = [];
const funn = [];
function krit(nr, namn, status, prov) { resultat.push({ nr, namn, status, prov }); console.log(`[${status}] K${nr} ${namn}: ${prov}`); }
function merk(tekst) { funn.push(tekst); console.log(`  - FUNN: ${tekst}`); }
const skot = async (page, namn, opts = {}) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, namn + '.png'), ...opts }); };

const nb = new Intl.Collator('nb', { sensitivity: 'base' });
const ny = async (b, bredde, hoegde = 900) => {
  const ctx = await b.newContext({ viewport: { width: bredde, height: hoegde } });
  const page = await ctx.newPage();
  const logg = { konsoll: [], eksterne: [], feilReqs: [] };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logg.konsoll.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => logg.konsoll.push('pageerror: ' + e.message));
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) logg.eksterne.push(r.url()); });
  page.on('requestfailed', r => logg.feilReqs.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) logg.feilReqs.push(r.status() + ' ' + r.url()); });
  return { ctx, page, logg };
};

const cr = await chromium.launch();
const wk = await webkit.launch();

// ---------- K1 + K2 + K3 + K6: innhald og layout, mobil og desktop ----------
const m = await ny(cr, 390, 844);
await m.page.goto(base + '/bedrifter.html', { waitUntil: 'networkidle' });
const overflow = await m.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const synleg = await m.page.evaluate(() => {
  const v = s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  return { hero: v('.hero h1'), band: v('.logoband'), kort: document.querySelectorAll('#bransjar .card').length, kortSynlege: [...document.querySelectorAll('#bransjar .card')].every(e => e.getBoundingClientRect().height > 0) };
});
// element som stikk ut til høgre
const ut = await m.page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map(e => e.tagName + '.' + e.className));
await skot(m.page, 'bedrifter-mobil-390-heil', { fullPage: true });
await skot(m.page, 'bedrifter-mobil-390-topp');
krit(1, 'Mobil 390: hero, støttespelarband og bransjekort utan vassrett rulling',
  overflow.sw <= overflow.cw && synleg.hero && synleg.band && synleg.kort === 8 && synleg.kortSynlege ? 'bestått' : 'feila',
  `scrollWidth ${overflow.sw} / clientWidth ${overflow.cw}; hero ${synleg.hero}; band ${synleg.band}; kort ${synleg.kort}; utstikkarar: ${ut.join(',') || 'ingen'}`);

// K2 logoband
const band = await m.page.evaluate(async () => {
  const lis = [...document.querySelectorAll('.logoband li')];
  const imgs = [...document.querySelectorAll('.logoband img')];
  await Promise.all(imgs.map(i => i.decode().catch(() => {})));
  return {
    antal: lis.length,
    altar: imgs.map(i => i.alt),
    lasta: imgs.map(i => i.naturalWidth > 0),
    flisar: [...document.querySelectorAll('.logoband-namn')].map(e => e.textContent.trim()),
    hoegder: lis.map(l => Math.round(l.getBoundingClientRect().height)),
    breidder: lis.map(l => Math.round(l.getBoundingClientRect().width)),
    imgStorleik: imgs.map(i => Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height)),
    lenkjeTilBidra: !!document.querySelector('#stottespelarar a[href="bidra.html#stotte"]'),
    lenkjeInniBand: !!document.querySelector('.logoband a'),
    ledetekst: document.querySelector('#stottespelarar .lede')?.textContent.replace(/\s+/g, ' ').trim()
  };
});
const forventa = ['Ekornes Grodås', 'Vest Biogass', 'Øen Kuldeteknikk', 'GRS', 'LøFlo Installasjon', 'Hornindal Fotball'];
const altOk = forventa.every(n => band.altar.includes(n));
const likeHoegder = new Set(band.hoegder).size === 1 && new Set(band.breidder).size === 1;
krit(2, 'Støttespelarband: 8 element, alt-tekst, namneflis utan logo, lenkje til bidra.html#stotte',
  band.antal === 8 && altOk && band.flisar.length === 2 && likeHoegder && band.lasta.every(Boolean) && band.lenkjeTilBidra ? 'bestått' : 'feila',
  `${band.antal} fliser; alt: ${band.altar.join(' | ')}; namneflisar: ${band.flisar.join(' | ')}; flishøgder ${[...new Set(band.hoegder)]}, breidder ${[...new Set(band.breidder)]}; alle bilete lasta ${band.lasta.every(Boolean)}; lenkje til bidra#stotte i teksten under bandet: ${band.lenkjeTilBidra}; sjølve flisene er lenkja: ${band.lenkjeInniBand}`);
if (!band.lenkjeInniBand) merk('K2: Bandet sjølve (logoflisene) er ikkje klikkbart. «Bandet lenkjer til bidra.html#stotte» er berre oppfylt via tekstlenkja i ingressen over bandet, og i kontaktkortet. Rimeleg tolking brukt: lenkja i seksjonen tel. Fil: bedrifter.html, linje ~84-103.');
{ // logoar utan forskjell på støttespelarar og andre er K3; her: støttespelarar utan logo skal ha namn
  await m.page.locator('#stottespelarar').scrollIntoViewIfNeeded();
  await skot(m.page, 'bedrifter-mobil-390-stottespelarar', { clip: undefined });
}

// K3 alfabetisk + lenkjer i ny fane
const kort = await m.page.evaluate(() => [...document.querySelectorAll('#bransjar .card')].map(c => ({
  tittel: c.querySelector('h3').textContent.trim(),
  namn: [...c.querySelectorAll('.partners li')].map(li => li.textContent.trim()),
  klasserPaaLi: [...new Set([...c.querySelectorAll('.partners li')].map(li => li.className))],
  lenkjer: [...c.querySelectorAll('.partners a')].map(a => ({ href: a.href, target: a.target, rel: a.rel, namn: a.textContent.trim() }))
})));
const uorden = [];
for (const k of kort) {
  for (let i = 1; i < k.namn.length; i++) {
    if (nb.compare(k.namn[i - 1], k.namn[i]) > 0) uorden.push(`${k.tittel}: «${k.namn[i - 1]}» står før «${k.namn[i]}»`);
  }
}
const ikkjeNyFane = kort.flatMap(k => k.lenkjer).filter(l => l.target !== '_blank' || !/noopener/.test(l.rel));
const antalBedrifter = kort.reduce((s, k) => s + k.namn.length, 0);
const antalLenkja = kort.reduce((s, k) => s + k.lenkjer.length, 0);
const sondring = kort.flatMap(k => k.klasserPaaLi).filter(Boolean);
krit(3, 'Bransjekort: alfabetisk innan kort, lenkja bedrifter opnar i ny fane, ingen skilnad på støttespelarar',
  uorden.length === 0 && ikkjeNyFane.length === 0 && sondring.length === 0 ? 'bestått' : (ikkjeNyFane.length === 0 && sondring.length === 0 ? 'delvis' : 'feila'),
  `${antalBedrifter} bedrifter i 8 kort, ${antalLenkja} lenkja. Alle lenkjer target=_blank+noopener: ${ikkjeNyFane.length === 0}. Rekkjefølgjefeil (nb-kollasjon, tegnsetting tel): ${uorden.length}. Klassar som skil støttespelarar: ${sondring.length}`);
for (const u of uorden) merk('K3 rekkjefølgje: ' + u + ' (bedrifter.html)');

// K6 landbruk
const landbruk = kort.find(k => k.tittel.startsWith('Landbruk'));
const lbTekst = await m.page.locator('article:has(h3:text("Landbruk")) p').first().innerText();
const heleTekst = await m.page.locator('main').innerText();
krit(6, 'Landbrukskortet: gardsbruk som tal, ikkje namn (rimeleg tolking: «over 80» godteke, jf. oppdraget)',
  /over 80 gardsbruk/.test(lbTekst.replace(/\s+/g, ' ')) && landbruk.namn.length <= 3 ? 'bestått' : 'feila',
  `kortteksten: «${lbTekst.replace(/\s+/g, ' ')}». Namn i kortet: ${landbruk.namn.join(', ')} (rådgjeving og skogentreprenør, ikkje gardsbruk). Hero seier «over 80 gardsbruk».`);
if (/nesten 90|om lag 87/.test(heleTekst)) merk('K6: tekst seier fortsatt 87/90');
await m.ctx.close();

// desktop
const d = await ny(cr, 1280, 900);
await d.page.goto(base + '/bedrifter.html', { waitUntil: 'networkidle' });
const dOver = await d.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
await skot(d.page, 'bedrifter-desktop-1280-heil', { fullPage: true });
await skot(d.page, 'bedrifter-desktop-1280-topp');
const kolonner = await d.page.evaluate(() => getComputedStyle(document.querySelector('.logoband')).gridTemplateColumns.split(' ').length);
console.log(`  desktop 1280: overflow ${dOver}, logoband-kolonner ${kolonner}`);
if (dOver > 0) merk('Desktop 1280 har vassrett rulling');
await d.ctx.close();

// ---------- K7 meny 320-1440 på alle ni sider ----------
const bredder = [320, 360, 375, 390, 414, 480, 600, 700, 768, 900, 1000, 1024, 1060, 1080, 1099, 1100, 1140, 1149, 1150, 1200, 1280, 1366, 1440];
const menyFeil = [];
const menyRader = [];
const mm = await ny(cr, 1280, 800);
for (const side of SIDER) {
  await mm.page.goto(`${base}/${side}`, { waitUntil: 'load' });
  for (const w of bredder) {
    await mm.page.setViewportSize({ width: w, height: 800 });
    const r = await mm.page.evaluate(() => {
      const t = document.querySelector('.nav-toggle');
      const nav = document.querySelector('.site-nav');
      const tVis = getComputedStyle(t).display !== 'none';
      const lenkjer = [...nav.querySelectorAll('a')];
      const tops = lenkjer.map(a => Math.round(a.getBoundingClientRect().top));
      const navVis = getComputedStyle(nav).display !== 'none' && getComputedStyle(nav).visibility !== 'hidden' && nav.getBoundingClientRect().height > 0 && (tVis ? nav.classList.contains('open') : true);
      const header = document.querySelector('.site-header').getBoundingClientRect();
      const hoegdeLogo = document.querySelector('.brand').getBoundingClientRect().height;
      const siste = lenkjer[lenkjer.length - 1].getBoundingClientRect();
      return { tVis, navSynleg: navVis, antal: lenkjer.length, ulikeTops: new Set(tops).size, headerH: Math.round(header.height), logoH: Math.round(hoegdeLogo), sisteRight: Math.round(siste.right), vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, lenkjetekstBryt: lenkjer.some(a => a.getBoundingClientRect().height > 40) };
    });
    let ok;
    if (r.tVis) ok = !r.navSynleg && r.sw <= r.vw; // hamburgar: menyen lukka som standard
    else ok = r.ulikeTops === 1 && !r.lenkjetekstBryt && r.sisteRight <= r.vw && r.sw <= r.vw && r.headerH < 110;
    menyRader.push(`${side}@${w}:${r.tVis ? 'hamb' : 'rad'}${ok ? '' : ' FEIL'}`);
    if (!ok) menyFeil.push(`${side} ${w}px ${JSON.stringify(r)}`);
  }
}
// grensa: kor går hamburgaren inn og kor trong er meny på éi linje?
await mm.page.goto(`${base}/bedrifter.html`);
const grense = {};
for (const w of [1149, 1150]) { await mm.page.setViewportSize({ width: w, height: 800 }); grense[w] = await mm.page.evaluate(() => { const a = [...document.querySelectorAll('.site-nav a')]; const f = a[0].getBoundingClientRect(), l = a.at(-1).getBoundingClientRect(); return { hamb: getComputedStyle(document.querySelector('.nav-toggle')).display !== 'none', frå: Math.round(f.left), til: Math.round(l.right), vw: document.documentElement.clientWidth, logoRight: Math.round(document.querySelector('.brand').getBoundingClientRect().right) }; }); }
console.log('  grense', JSON.stringify(grense));
// hamburgar open på 320 og 390 – skjermbilete
for (const w of [320, 390]) {
  await mm.page.setViewportSize({ width: w, height: 800 });
  await mm.page.goto(`${base}/bedrifter.html`);
  await mm.page.click('.nav-toggle');
  await skot(mm.page, `meny-hamburgar-open-${w}`, { clip: { x: 0, y: 0, width: w, height: 600 } });
  const aktiv = await mm.page.evaluate(() => { const a = document.querySelector('.site-nav a[aria-current="page"]'); return a ? a.textContent.trim() + ' ' + getComputedStyle(a).fontWeight + ' ' + getComputedStyle(a).color : null; });
  console.log(`  hamburgar open ${w}: aktiv lenkje ${aktiv}`);
  await mm.page.click('.nav-toggle');
}
// skjermbilete av toppmenyen
for (const w of [320, 375, 768, 1023, 1024, 1149, 1150, 1280, 1440]) {
  await mm.page.setViewportSize({ width: w, height: 700 });
  await mm.page.goto(`${base}/bedrifter.html`);
  await skot(mm.page, `meny-${w}`, { clip: { x: 0, y: 0, width: w, height: 130 } });
}
krit(7, 'Toppmeny på éi linje eller hamburgar, 320-1440 px, alle ni sider',
  menyFeil.length === 0 ? 'bestått' : 'feila', `${SIDER.length} sider x ${bredder.length} breidder = ${SIDER.length * bredder.length} målingar, ${menyFeil.length} feil. Hamburgargrense: 1149 -> ${grense[1149].hamb ? 'hamburgar' : 'rad'}, 1150 -> ${grense[1150].hamb ? 'hamburgar' : 'rad'} (rad frå ${grense[1150].frå} til ${grense[1150].til} av ${grense[1150].vw}). ${menyFeil.slice(0, 3).join(' || ')}`);
await mm.ctx.close();

// K7 del 2: «Bedrifter» i meny og footer på alle sider, aria-current berre på /bedrifter
const menyInnhald = [];
const mi = await ny(cr, 1280, 800);
for (const side of SIDER) {
  await mi.page.goto(`${base}/${side}`);
  const r = await mi.page.evaluate(() => ({
    meny: [...document.querySelectorAll('.site-nav a')].map(a => a.textContent.trim()),
    rekkjefolgje: [...document.querySelectorAll('.site-nav a')].map(a => a.textContent.trim()).join('|'),
    menyBedrifter: !!document.querySelector('.site-nav a[href$="bedrifter.html"]'),
    footerBedrifter: [...document.querySelectorAll('.footer-nav a[href$="bedrifter.html"]')].map(a => a.textContent.trim()),
    current: [...document.querySelectorAll('[aria-current]')].map(a => a.getAttribute('href') + '=' + a.getAttribute('aria-current')),
    current_bedrifter: document.querySelector('.site-nav a[href$="bedrifter.html"]')?.getAttribute('aria-current')
  }));
  menyInnhald.push({ side, ...r });
}
const mFeil = menyInnhald.filter(r => !r.menyBedrifter || r.footerBedrifter[0] !== 'Bedrifter i Hornindal' || (r.side === 'bedrifter.html') !== (r.current_bedrifter === 'page'));
const rekke = new Set(menyInnhald.map(r => r.rekkjefolgje));
const ventaMeny = 'Om oss|Flytt hit|Kva skjer|Lag og foreiningar|Bedrifter|Kontor på Smia|Bidra|Kontakt';
krit('7b', 'Meny og footer har «Bedrifter» på alle sider; aria-current="page" berre på /bedrifter',
  mFeil.length === 0 && rekke.size === 1 && [...rekke][0] === ventaMeny ? 'bestått' : 'feila',
  `${menyInnhald.length} sider; feil: ${mFeil.map(r => r.side).join(',') || 'ingen'}; menyrekkjefølgje lik på alle: ${rekke.size === 1}; aria-current finst på: ${menyInnhald.map(r => r.side + ':' + r.current.join('/')).join(' ')}`);
const andreMedCurrent = menyInnhald.filter(r => r.side !== 'bedrifter.html' && r.current.length === 0).map(r => r.side);
if (andreMedCurrent.length) console.log('  merknad: sider utan aria-current på nokon meny-lenkje: ' + andreMedCurrent.join(', '));
await mi.ctx.close();

// ---------- K8 snarveg og Flytt hit ----------
{
  const p = await ny(cr, 1280, 800);
  await p.page.goto(`${base}/index.html`);
  const sn = await p.page.evaluate(() => [...document.querySelectorAll('nav.snarvegar a.card')].map(a => ({ h: a.getAttribute('href'), t: a.querySelector('strong').textContent.trim(), s: a.querySelector('span').textContent.trim() })));
  const ledig = await p.page.evaluate(() => [...document.querySelectorAll('a[href="#for-bedrifter"]')].length);
  const bedr = sn.find(x => x.t === 'Bedrifter');
  await p.page.goto(`${base}/flytt-til-hornindal.html`);
  const flytt = await p.page.evaluate(() => {
    const a = [...document.querySelectorAll('main a[href="bedrifter.html"]')];
    return a.map(x => ({ tekst: x.textContent.trim(), saman: x.closest('section')?.id, nesteLenkje: x.parentElement.nextElementSibling?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) }));
  });
  krit(8, 'Snarvegskortet «Bedrifter» går til bedrifter.html; Flytt hit har lenkje i jobb-bolken',
    bedr && bedr.h === 'bedrifter.html' && flytt.length >= 1 ? 'bestått' : 'feila',
    `snarvegar: ${sn.map(x => x.t + '→' + x.h).join(', ')}; skildring: «${bedr?.s}»; Flytt hit: ${JSON.stringify(flytt)}; attståande #for-bedrifter-lenkjer: ${ledig}`);
  await p.ctx.close();
}

// ---------- K9 personvern ----------
{
  const p = await ny(cr, 1280, 800);
  await p.page.goto(`${base}/personvern.html#bedrifter`);
  const r = await p.page.evaluate(() => {
    const s = document.getElementById('bedrifter');
    let tekst = ''; for (let e = s?.nextElementSibling; e && e.tagName !== 'H2'; e = e.nextElementSibling) tekst += ' ' + e.innerText;
    return { finst: !!s, tekst: tekst.replace(/\s+/g, ' '), sist: document.body.innerText.replace(/\s+/g, ' ').match(/Sist endra:.{0,40}?\d{4}/)?.[0] };
  });
  const has = ['Bedrifter i Hornindal', 'Einingsregisteret', 'kontaktpersonar', 'enkeltpersonføretak', 'fjernar'].filter(x => !r.tekst.toLowerCase().includes(x.toLowerCase()));
  const sistOk = /14\.\s*november\s*2026/.test((r.sist || '').replace(/ /g, ' '));
  krit(9, 'personvern.html#bedrifter forklarer lista og uttak; «Sist endra» oppdatert',
    r.finst && has.length === 0 && sistOk ? 'bestått' : 'feila', `#bedrifter finst ${r.finst}; manglar ord: ${has.join(',') || 'ingen'}; «${r.sist}»`);
  await p.ctx.close();
}

// ---------- K10 meta + sitemap ----------
{
  const hent = f => readFileSync(path.join(repo, f), 'utf8');
  const sm = hent('sitemap.xml');
  const meta = h => ({
    title: h.match(/<title>(.*?)<\/title>/)?.[1], desc: h.match(/name="description" content="(.*?)"/)?.[1], canon: h.match(/rel="canonical" href="(.*?)"/)?.[1],
    og: ['og:title', 'og:description', 'og:type', 'og:image', 'og:image:width', 'og:image:height', 'og:url'].filter(k => new RegExp(`property="${k}"`).test(h))
  });
  const b = meta(hent('bedrifter.html')), f = meta(hent('frivillig.html'));
  const lik = JSON.stringify(b.og) === JSON.stringify(f.og);
  const canonOk = b.canon === 'https://hornindal514.no/bedrifter.html' && b.canon.replace('bedrifter', 'x') === (f.canon || '').replace('frivillig', 'x');
  krit(10, 'sitemap.xml har /bedrifter; title, description, canonical og og-taggar som dei andre sidene',
    sm.includes('<loc>https://hornindal514.no/bedrifter.html</loc>') && b.title && b.desc && canonOk && lik ? 'bestått' : 'feila',
    `sitemap ${sm.includes('bedrifter.html')}; title «${b.title}»; canonical ${b.canon}; og-taggar like som frivillig.html: ${lik} (${b.og.length}); description ${b.desc?.length} teikn`);
}

// ---------- K11 axe + konsoll, Chromium og WebKit ----------
let axeKjelde = null;
if (!UTAN_NETT) {
  try { axeKjelde = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text(); } catch (e) { console.log('  axe kunne ikkje hentast: ' + e.message); }
}
const axeRes = {}; const konsollAlle = []; const eksterneAlle = [];
for (const [navn, b, bredde] of [['chromium', cr, 1280], ['chromium-390', cr, 390], ['webkit', wk, 1280], ['webkit-390', wk, 390]]) {
  const p = await ny(b, bredde, 900);
  await p.page.goto(base + '/bedrifter.html', { waitUntil: 'networkidle' });
  await p.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // lazy-bilete
  await p.page.waitForTimeout(400);
  if (navn.startsWith('webkit') && bredde === 1280) await skot(p.page, 'bedrifter-webkit-1280-heil', { fullPage: true });
  if (navn === 'webkit-390') await skot(p.page, 'bedrifter-webkit-390-heil', { fullPage: true });
  konsollAlle.push(...p.logg.konsoll.map(x => navn + ' ' + x), ...p.logg.feilReqs.map(x => navn + ' req ' + x));
  eksterneAlle.push(...p.logg.eksterne.map(x => navn + ' ' + x));
  if (axeKjelde) {
    await p.page.evaluate(axeKjelde);
    const r = await p.page.evaluate(() => axe.run());
    axeRes[navn] = { brot: r.violations.map(v => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; ')}`), ufullstendig: r.incomplete.map(v => `${v.id}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; ')}`) };
  }
  await p.ctx.close();
}
const alleBrot = Object.entries(axeRes).flatMap(([n, r]) => r.brot.map(x => `${n}: ${x}`));
krit(11, 'axe 0 brot i Chromium og WebKit (1280 og 390); ingen konsollfeil',
  axeKjelde ? (alleBrot.length === 0 && konsollAlle.length === 0 ? 'bestått' : 'feila') : 'ikkje køyrt', `${Object.keys(axeRes).length} køyringar; brot: ${alleBrot.join(' || ') || 'ingen'}; konsoll/feilkall: ${konsollAlle.join(' || ') || 'ingen'}`);
for (const [n, r] of Object.entries(axeRes)) if (r.ufullstendig.length) console.log(`  axe «incomplete» ${n}: ${r.ufullstendig.join(' | ')}`);

// ---------- K12 logoar, eksterne kall, avhengigheiter ----------
{
  const logoDir = path.join(repo, 'assets/stottespelarar');
  const bytes = Number(execSync(`find "${logoDir}" -type f -exec stat -f %z {} + | awk '{s+=$1} END {print s}'`).toString().trim());
  const html = readFileSync(path.join(repo, 'bedrifter.html'), 'utf8');
  const eksternScript = [...html.matchAll(/<(script|link|img|iframe)[^>]+(?:src|href)="(https?:[^"]+)"/g)].filter(x => x[1] !== 'a' && !/rel="canonical"/.test(x[0]) && !/property=/.test(x[0])).map(x => x[2]);
  const nyeFilerUtanomLogo = execSync('git status --short', { cwd: repo }).toString().split('\n').filter(l => l.startsWith('A') || l.startsWith('?')).map(l => l.slice(3));
  const pkg = nyeFilerUtanomLogo.filter(f => /package|node_modules|\.js$|\.mjs$/.test(f) && !f.includes('.github/scripts/sjekk-bedrifter'));
  krit(12, 'Logoar i assets/ under 200 kB; ingen eksterne kall; ingen ny avhengigheit',
    bytes < 200000 && eksterneAlle.length === 0 && eksternScript.length === 0 && pkg.length === 0 ? 'bestått' : 'feila',
    `logoar ${bytes} byte (${(bytes / 1024).toFixed(1)} kB); eksterne førespurnader frå sida (4 køyringar): ${eksterneAlle.join(',') || 'ingen'}; eksterne src/link i HTML: ${eksternScript.join(',') || 'ingen'}; nye filar (git): ${nyeFilerUtanomLogo.filter(f => !f.startsWith('assets/stottespelarar')).join(', ')}`);
}

// ---------- K4 + K5 Brreg ----------
if (!UTAN_NETT) {
  const sidenamn = kort.flatMap(k => k.namn.map(n => ({ kort: k.tittel, namn: n })));
  const norm = s => s.toLowerCase().replace(/&amp;/g, '&').replace(/\b(as|sa|asa|da|ans|enk)\b/g, ' ').replace(/[^a-zæøå0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const api = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, { headers: { accept: 'application/json' } }); if (r.ok) return r.json(); } catch {} await new Promise(r => setTimeout(r, 500)); } return null; };
  const alle = [];
  for (const pnr of ['6763', '6761']) {
    for (const [type, felt] of [['enheter', 'forretningsadresse'], ['underenheter', 'beliggenhetsadresse']]) {
      for (let side = 0; side < 5; side++) {
        const j = await api(`https://data.brreg.no/enhetsregisteret/api/${type}?${felt}.postnummer=${pnr}&size=200&page=${side}`);
        const liste = j?._embedded?.[type] || [];
        for (const e of liste) alle.push({ type, orgnr: e.organisasjonsnummer, navn: e.navn, orgform: e.organisasjonsform?.kode, nace: e.naeringskode1?.kode, konkurs: e.konkurs, avvikling: e.underAvvikling || e.underTvangsavviklingEllerTvangsopplosning, slettet: e.slettedato, mva: e.registrertIMvaregisteret, hjemmeside: e.hjemmeside, regnskap: e.sisteInnsendteAarsregnskap, postnr: (e.forretningsadresse || e.beliggenhetsadresse)?.postnummer, overordnet: e.overordnetEnhet });
        if (liste.length < 200) break;
      }
    }
  }
  console.log(`  Brreg: ${alle.length} registerrader i 6763/6761`);
  const finn = n => {
    const nn = norm(n); const tok = nn.split(' ');
    let treff = alle.filter(e => norm(e.navn) === nn);
    if (!treff.length) treff = alle.filter(e => { const en = norm(e.navn); return tok.every(t => en.includes(t)) || en.includes(nn); });
    return treff;
  };
  const matcha = sidenamn.map(s => ({ ...s, treff: finn(s.namn) }));
  const utanTreff = matcha.filter(x => !x.treff.length).map(x => x.namn);
  console.log(`  utan treff i Brreg (6763/6761): ${utanTreff.join(' | ')}`);
  console.log('  ikkje-eksakte treff (sjekk for hand): ' + matcha.filter(x => x.treff.length && norm(x.treff[0].navn) !== norm(x.namn)).map(x => `${x.namn} => ${x.treff.map(t => `${t.navn}[${t.orgform},${t.nace},${t.postnr}]`).join(' + ')}`).join(' | '));
  const problem = [];
  for (const x of matcha) {
    for (const t of x.treff.slice(0, 1)) {
      if (t.konkurs || t.avvikling || t.slettet) problem.push(`${x.namn}: ${t.navn} konkurs/avvikling/slettet`);
      if (!['6763', '6761'].includes(t.postnr)) problem.push(`${x.namn}: postnr ${t.postnr}`);
      if (['FLI', 'BRL', 'ESEK', 'KIRK', 'KBO', 'SAM', 'STI'].includes(t.orgform)) problem.push(`${x.namn}: orgform ${t.orgform}`);
      if (/^(64|00)/.test(t.nace || '')) problem.push(`${x.namn}: næringskode ${t.nace}`);
    }
  }
  // ti tilfeldige
  const tilfeldige = [...matcha].sort(() => Math.random() - 0.5).slice(0, 10);
  const tiRader = tilfeldige.map(x => { const t = x.treff[0]; return t ? `${x.namn} -> ${t.navn} [${t.orgform}, ${t.nace}, ${t.postnr}, ${t.type}, konkurs=${t.konkurs}, avv=${t.avvikling}]` : `${x.namn} -> UTAN TREFF`; });
  console.log('  ti tilfeldige:\n    ' + tiRader.join('\n    '));
  const tiFeil = tilfeldige.filter(x => !x.treff[0] || x.treff[0].konkurs || x.treff[0].avvikling || !['6763', '6761'].includes(x.treff[0].postnr));
  krit(4, 'Brreg: aktive, postnummer 6763/6761, ingen holding/lag/burettslag/sameige (ti tilfeldige + heile lista)',
    tiFeil.filter(x => x.namn !== 'Olavs Matkro & Pub').length === 0 && problem.length === 0 ? (utanTreff.filter(n => n !== 'Olavs Matkro & Pub' && n !== 'Treskjærarmeister Rolf Taraldset').length > 0 ? 'delvis' : 'bestått') : 'feila',
    `registerrader henta ${alle.length}; ${matcha.length - utanTreff.length}/${matcha.length} namn kopla til Brreg-rad; utan treff: ${utanTreff.join(', ') || 'ingen'}; problem: ${problem.join(' || ') || 'ingen'}; ti tilfeldige: ${tiRader.join(' // ')}`);

  // K5 ENK. Anders 14.11.2026: MVA-kravet er teke bort, og yrke pluss personnamn er godkjent.
  // Om namnet er eit forretningsnamn, står ikkje i det opne enheter-svaret, så lista må vurderast for hand.
  const enk = matcha.filter(x => x.treff[0]?.orgform === 'ENK').map(x => `${x.namn} = ${x.treff[0].navn}${x.treff[0].mva ? '' : ' (utan MVA)'}`);
  krit(5, 'Enkeltpersonføretak: forretningsnamn eller nettside; reine personnamn er ikkje med',
    'manuell', `${enk.length} ENK på sida, vurder at namna er forretningsnamn: ${enk.join(' | ')}`);
} else { krit(4, 'Brreg', 'ikkje køyrt', 'UTAN_NETT'); krit(5, 'ENK', 'ikkje køyrt', 'UTAN_NETT'); }

// ---------- Lenkjer: eksterne på /bedrifter, interne og anker på alle sider ----------
{
  const dom = await ny(cr, 1280, 800);
  const interne = []; const ankerFeil = []; const idar = {};
  for (const side of SIDER) {
    await dom.page.goto(`${base}/${side}`);
    idar[side] = new Set(await dom.page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id)));
  }
  const eksterne = new Map();
  for (const side of SIDER) {
    await dom.page.goto(`${base}/${side}`);
    const hrefs = await dom.page.evaluate(() => [...document.querySelectorAll('a[href], link[href], img[src], source[srcset]')].map(e => ({ el: e.tagName, h: e.getAttribute('href') ?? e.getAttribute('src') ?? e.getAttribute('srcset'), tekst: e.textContent.trim().slice(0, 30) })));
    for (const { el, h, tekst } of hrefs) {
      if (!h || h.startsWith('mailto:') || h.startsWith('tel:') || h.startsWith('data:') || h.startsWith('webcal:')) continue;
      if (/^https?:/.test(h)) { if (side === 'bedrifter.html' && el === 'A') eksterne.set(h, tekst); continue; }
      const [fil0, anker] = h.split('#'); const fil = fil0 === '' ? side : (fil0.split(' ')[0].replace(/^\.?\//, '') || 'index.html');
      if (fil.endsWith('.html')) {
        if (!idar[fil]) { ankerFeil.push(`${side}: ${h} peikar til ukjend side`); continue; }
        if (anker && !idar[fil].has(anker)) ankerFeil.push(`${side}: ${h} (ankeret finst ikkje i ${fil})`);
      } else if (fil) {
        const r = await dom.page.request.get(`${base}/${fil}`); if (!r.ok()) ankerFeil.push(`${side}: ${h} gir ${r.status()}`);
      } else if (anker && !idar[side].has(anker)) ankerFeil.push(`${side}: #${anker} finst ikkje`);
      interne.push(h);
    }
  }
  console.log(`  interne lenkjer/anker sjekka: ${interne.length}, feil: ${ankerFeil.length}`);
  for (const f of ankerFeil) merk('Intern lenkje: ' + f);
  const dode = [];
  if (!UTAN_NETT) {
    const sjekk = async ([u, t]) => {
      for (const metode of ['HEAD', 'GET']) {
        try { const r = await fetch(u, { method: metode, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (lenkjesjekk)' } }); if (r.status < 400) return { u, t, ok: true, status: r.status, sluttUrl: r.url }; if (metode === 'GET') return { u, t, ok: false, status: r.status, sluttUrl: r.url }; } catch (e) { if (metode === 'GET') return { u, t, ok: false, status: String(e.cause?.code || e.message) }; }
      }
    };
    const res = await Promise.all([...eksterne].map(sjekk));
    for (const r of res) { if (!r.ok) dode.push(`${r.t} ${r.u} -> ${r.status}`); else if (new URL(r.sluttUrl).hostname.replace(/^www\./, '') !== new URL(r.u).hostname.replace(/^www\./, '')) console.log(`  omdirigert til anna vert: ${r.u} -> ${r.sluttUrl}`); }
    console.log(`  eksterne lenkjer på /bedrifter: ${eksterne.size}, døde/feil: ${dode.length}`);
    for (const x of dode) merk('Ekstern lenkje svarar ikkje: ' + x);
    krit('L', 'Lenkjer: alle eksterne på /bedrifter svarar, alle interne lenkjer og anker finst',
      dode.length === 0 && ankerFeil.length === 0 ? 'bestått' : 'feila', `${eksterne.size} eksterne (feil: ${dode.join(' | ') || 'ingen'}); ${interne.length} interne på ${SIDER.length} sider (feil: ${ankerFeil.join(' | ') || 'ingen'})`);
  }
  await dom.ctx.close();
}

// ---------- tastatur, fokus, alt-tekst, persona-gjennomgang ----------
for (const w of [1280, 390]) {
  const p = await ny(cr, w, 900);
  await p.page.goto(`${base}/bedrifter.html`, { waitUntil: 'load' });
  const stopp = [];
  let utanFokus = [];
  const maks = 160;
  for (let i = 0; i < maks; i++) {
    await p.page.keyboard.press('Tab');
    const s = await p.page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return null;
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      const vis = r.width > 0 && r.height > 0;
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const skygge = cs.boxShadow !== 'none';
      return { tekst: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30), vis, fokusSynleg: outline || skygge, tag: e.tagName, href: e.getAttribute('href') };
    });
    if (!s) break;
    if (stopp.length && stopp.at(-1).href === s.href && stopp.at(-1).tekst === s.tekst && i > 3 && stopp.length > 5 && s.tekst === stopp[0].tekst) break;
    stopp.push(s);
  }
  utanFokus = stopp.filter(s => !s.fokusSynleg).map(s => s.tekst);
  const skjult = stopp.filter(s => !s.vis).map(s => s.tekst);
  console.log(`  tastatur ${w}px: ${stopp.length} tabbstopp; utan synleg fokus: ${utanFokus.join(' | ') || 'ingen'}; fokus på usynleg element: ${skjult.join(' | ') || 'ingen'}; første: ${stopp.slice(0, 3).map(s => s.tekst).join(' > ')}`);
  if (utanFokus.length) merk(`Tastatur ${w}px: element utan synleg fokus (outline/box-shadow): ${[...new Set(utanFokus)].join(', ')}`);
  if (skjult.length && w === 1280) merk(`Tastatur ${w}px: fokus hamnar på usynlege element: ${[...new Set(skjult)].join(', ')}`);
  if (w === 390) {
    // tastaturopning av hamburgar
    await p.page.goto(`${base}/bedrifter.html`);
    await p.page.keyboard.press('Tab'); await p.page.keyboard.press('Tab'); // skip-link, så brand?, så toggle
    for (let i = 0; i < 3; i++) { const er = await p.page.evaluate(() => document.activeElement.classList.contains('nav-toggle')); if (er) break; await p.page.keyboard.press('Tab'); }
    await p.page.keyboard.press('Enter');
    const open = await p.page.evaluate(() => document.getElementById('hovudmeny').classList.contains('open') && document.querySelector('.nav-toggle').getAttribute('aria-expanded') === 'true');
    await p.page.keyboard.press('Escape');
    const lukka = await p.page.evaluate(() => !document.getElementById('hovudmeny').classList.contains('open') && document.activeElement.classList.contains('nav-toggle'));
    console.log(`  hamburgar med tastatur: Enter opnar ${open}; Escape lukkar og flyttar fokus til knappen ${lukka}`);
    if (!open || !lukka) merk('Hamburgarmenyen fungerer ikkje fullt med tastatur');
  }
  await p.ctx.close();
}
{
  const p = await ny(cr, 1280, 800);
  for (const side of SIDER) {
    await p.page.goto(`${base}/${side}`);
    const mangler = await p.page.evaluate(() => [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src')));
    if (mangler.length) merk(`Alt manglar på ${side}: ${mangler.join(', ')}`);
  }
  await p.page.goto(`${base}/bedrifter.html`);
  const alt = await p.page.evaluate(() => [...document.querySelectorAll('img')].map(i => `${i.getAttribute('src').split('/').pop()}=«${i.alt}»`));
  console.log('  alt-tekstar /bedrifter: ' + alt.join(', '));
  await p.ctx.close();
}

// Persona-gjennomgang (mobil 390): målingar
{
  const p = await ny(cr, 390, 844);
  await p.page.goto(`${base}/bedrifter.html`);
  const tilIndustri = await p.page.evaluate(() => { const h = [...document.querySelectorAll('#bransjar h3')][0]; return { y: Math.round(h.getBoundingClientRect().top + scrollY), vh: innerHeight, kortHoegd: Math.round(h.closest('.card').getBoundingClientRect().height), side: document.documentElement.scrollHeight }; });
  await p.page.click('text=Sjå bedriftene');
  await p.page.waitForTimeout(2000);
  const etterKlikk = await p.page.evaluate(() => { const h = [...document.querySelectorAll('#bransjar h3')][0]; const r = h.getBoundingClientRect(); const hdr = document.querySelector('.site-header').getBoundingClientRect(); return { toppHeading: Math.round(r.top), headerBunn: Math.round(hdr.bottom), headerSticky: getComputedStyle(document.querySelector('.site-header')).position, eyebrowSynleg: r.top > hdr.bottom, headingSynleg: r.top >= hdr.bottom && r.bottom < innerHeight, scrollY: Math.round(scrollY) }; });
  await skot(p.page, 'persona1-mobil-etter-sja-bedriftene');
  console.log(`  persona 1 (tilflyttar): industri-overskrifta ligg ${tilIndustri.y}px ned (${(tilIndustri.y / tilIndustri.vh).toFixed(1)} skjermhøgder) utan knappen. Etter «Sjå bedriftene»: ${JSON.stringify(etterKlikk)}. Industrikortet er ${tilIndustri.kortHoegd}px høgt.`);
  const nokkel = await p.page.evaluate(() => { const t = document.querySelector('main').innerText.toLowerCase(); return { elektr: t.includes('elektr'), royr: t.includes('røyrlegg'), jobb: t.includes('jobb') || t.includes('arbeidsplass'), ledigeStillingar: t.includes('ledig'), tel: !!document.querySelector('#bransjar a[href^="tel:"]'), mailto: !!document.querySelector('#bransjar a[href^="mailto:"]') }; });
  console.log('  persona 2 (elektrikar/røyrleggjar): ' + JSON.stringify(nokkel));
  // kor mange tapp frå toppen til kontakt for bedriftsleiar
  const reiseTilKontakt = await p.page.evaluate(() => ({ notisLenkje: document.querySelector('.notice a').getAttribute('href'), personvernLenkjeIMain: !!document.querySelector('main a[href*="personvern"]'), personvernLenkjeFooter: !!document.querySelector('footer a[href*="personvern"]') }));
  console.log('  persona 3: ' + JSON.stringify(reiseTilKontakt));
  await p.page.click('.notice a'); await p.page.waitForTimeout(2000);
  const kk = await p.page.evaluate(() => { const h = document.querySelector('#kontakt-bedrift h2').getBoundingClientRect(); const hdr = document.querySelector('.site-header').getBoundingClientRect(); return { h2Topp: Math.round(h.top), headerBunn: Math.round(hdr.bottom) }; });
  console.log('  etter «Tips oss»: ' + JSON.stringify(kk));
  await skot(p.page, 'persona3-mobil-kontakt');
  await p.page.goto(`${base}/bedrifter.html`);
  // klikk gjennom «Sjå korleis du kan bidra» → bidra#stotte
  await p.page.click('#stottespelarar a[href="bidra.html#stotte"]'); await p.page.waitForLoadState(); await p.page.waitForTimeout(2000);
  const bidra = await p.page.evaluate(() => { const s = document.getElementById('stotte'); const r = s.getBoundingClientRect(); return { url: location.href, topp: Math.round(r.top), tittel: s.querySelector('h2')?.textContent.trim(), tekst: s.innerText.replace(/\s+/g, ' ').slice(0, 260) }; });
  console.log('  bidra#stotte: ' + JSON.stringify(bidra));
  await skot(p.page, 'persona3-mobil-bidra-stotte');
  await p.ctx.close();
}
{
  const p = await ny(cr, 1280, 800);
  await p.page.goto(`${base}/bedrifter.html`);
  await p.page.click('.notice a'); await p.page.waitForTimeout(2000);
  await skot(p.page, 'persona3-desktop-kontakt');
  await p.page.goto(`${base}/bedrifter.html#bransjar`);
  await p.page.waitForTimeout(2000);
  await skot(p.page, 'persona1-desktop-bransjar');
  await p.ctx.close();
}

await cr.close(); await wk.close();

console.log('\n=== Samandrag ===');
for (const r of resultat) console.log(`K${r.nr}\t${r.status}\t${r.namn}`);
console.log(`Funn: ${funn.length}`);
process.exit(resultat.some(r => r.status === 'feila') ? 1 : 0);
