// Lagar Google-skjemaet «Meld inn eit arrangement» og reknearket svara hamnar
// i. Lim inn i eit nytt prosjekt på script.google.com og køyr lagSkjema éin
// gong. Lenkjene står i utføringsloggen etterpå.
//
// Reknearket får kolonna «Godkjent» (L) med avkryssingsboksar og fana
// «Publisert» med berre dei godkjende arrangementa. Den fana blir publisert
// som CSV, og arrangement.py les ho. Endrar du spørsmåla i skjemaet, flyttar
// kolonnene seg, og då må formelen i «Publisert» rettast.
function lagSkjema() {
  var skjema = FormApp.create('Meld inn eit arrangement')
    .setDescription('Arrangement i Hornindal til kalenderen på Kva skjer-sida til Hornindal 514 Utvikling. Vi ser over alt før det kjem i kalenderen. Alt du skriv, kan bli publisert. Personvern: https://hornindal514.no/personvern.html#arrangement')
    .setConfirmationMessage('Takk! Arrangementet kjem i kalenderen når vi har sett over det.')
    .setCollectEmail(false)
    .setProgressBar(false);
  skjema.addTextItem().setTitle('Kva heiter arrangementet?').setRequired(true);
  skjema.addDateItem().setTitle('Dato').setRequired(true);
  skjema.addDateItem().setTitle('Til og med').setHelpText('Berre om arrangementet varer fleire dagar.');
  skjema.addTimeItem().setTitle('Startar klokka');
  skjema.addTimeItem().setTitle('Sluttar klokka');
  skjema.addTextItem().setTitle('Stad').setHelpText('Til dømes Honndalshallen eller Smia.');
  skjema.addTextItem().setTitle('Arrangør').setHelpText('Laget, bedrifta eller gruppa som står bak.');
  skjema.addTextItem().setTitle('Lenkje').setHelpText('Til dømes til Facebook-arrangementet eller nettsida til arrangøren.');
  skjema.addParagraphTextItem().setTitle('Kort om arrangementet');
  skjema.addTextItem().setTitle('Kjem det att kvart år?').setHelpText('Skriv når, til dømes «første helga i august». La feltet stå tomt om det ikkje er fast.');

  var id = SpreadsheetApp.create('Meld inn eit arrangement (svar)').getId();
  skjema.setDestination(FormApp.DestinationType.SPREADSHEET, id);
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  var ark = SpreadsheetApp.openById(id);
  var svar = ark.getSheets().filter(function (s) { return s.getFormUrl(); })[0];

  // A er tidsmerket og B-K dei ti spørsmåla, så Godkjent blir L.
  if (svar.getMaxColumns() < 12) svar.insertColumnsAfter(svar.getMaxColumns(), 12 - svar.getMaxColumns());
  svar.getRange('L1').setValue('Godkjent');
  svar.getRange('L2:L').insertCheckboxes();

  // Semikolon mellom argumenta: setFormula følgjer språkoppsettet i reknearket,
  // og med norsk oppsett gir komma #ERROR!.
  var pub = ark.insertSheet('Publisert');
  pub.getRange('A1').setFormula("=QUERY('" + svar.getName() + "'!A:L; \"" +
    "select A, B, C, D, E, F, G, H, I, J, K where L = true order by C " +
    "label A 'id', B 'tittel', C 'dato', D 'til', E 'start', F 'slutt', G 'stad', H 'arrangor', I 'lenkje', J 'omtale', K 'regel' " +
    "format A 'yyyy-mm-dd hh:mm:ss', C 'yyyy-mm-dd', D 'yyyy-mm-dd', E 'hh:mm', F 'hh:mm'\"; 1)");

  // Det tomme standardarket treng vi ikkje.
  ark.getSheets().forEach(function (s) {
    if (s.getSheetId() !== svar.getSheetId() && s.getSheetId() !== pub.getSheetId()) ark.deleteSheet(s);
  });

  Logger.log('Skjemaet, til nettsida: ' + skjema.getPublishedUrl());
  Logger.log('Redigere skjemaet: ' + skjema.getEditUrl());
  Logger.log('Reknearket: ' + ark.getUrl());
}

// Godkjende arrangement går ut med ein gong: når «Godkjent» blir kryssa av
// eller fjerna, eller ein godkjend rad blir endra, startar arket
// arrangementsjobben på GitHub. Jobben ventar sjølv til den publiserte lista
// har fått endringa. Timesjobben går som før om dette feilar. Når nokon
// melder inn eit arrangement, kjem det eit varsel i Slack.
//
// Oppsett éin gong i dette prosjektet: legg inn skripteigenskapane ARK_ID
// (id-en til reknearket), GITHUB_TOKEN (fine-grained token med tilgang berre
// til hornindal514-utvikling og «Actions: Read and write») og SLACK_WEBHOOK
// (Incoming Webhook-adressa), og køyr startAutoPublisering. Køyr han på nytt
// når ein av dei er bytt. Det valfrie e-postfeltet kjem med leggTilEpost.
function startAutoPublisering() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['vedEndring', 'vedInnsending', 'ryddEpost'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  var arkId = PropertiesService.getScriptProperties().getProperty('ARK_ID');
  ScriptApp.newTrigger('vedEndring').forSpreadsheet(arkId).onEdit().create();
  ScriptApp.newTrigger('vedInnsending').forSpreadsheet(arkId).onFormSubmit().create();
  ScriptApp.newTrigger('ryddEpost').timeBased().everyDays(1).atHour(3).create();
  publiser(); // prøver GitHub-nøkkelen med ein gong
  varsle('Varsel om nye arrangement er slått på.'); // og Slack-adressa
  Logger.log('Klart. Godkjende arrangement går ut med ein gong, og nye kjem som varsel i Slack.');
}

function vedEndring(e) {
  var r = e.range, ark = r.getSheet();
  if (!ark.getFormUrl() || r.getLastRow() < 2) return; // berre svara, ikkje overskrifta eller «Publisert»
  var g = kolonne(ark, 'Godkjent'), fra = Math.max(r.getRow(), 2);
  var endraGodkjent = r.getColumn() <= g && r.getLastColumn() >= g;
  var godkjendRad = ark.getRange(fra, g, r.getLastRow() - fra + 1, 1).getValues()
    .some(function (v) { return v[0] === true; });
  if (endraGodkjent || godkjendRad) publiser();
}

function publiser() {
  var svar = UrlFetchApp.fetch('https://api.github.com/repos/anderslo/hornindal514-utvikling/actions/workflows/arrangement.yml/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'),
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  });
  var kode = svar.getResponseCode();
  if (kode < 200 || kode > 299) throw new Error('GitHub svarte ' + kode + ': ' + svar.getContentText());
}

// Berre tittel, dato og stad går til Slack, aldri e-postadressa. Resten står i arket.
function vedInnsending(e) {
  var v = e.values, ark = e.range.getSheet(); // B tittel, C dato, G stad
  var lenkje = ark.getParent().getUrl() + '#gid=' + ark.getSheetId() + '&range=' +
    bokstav(kolonne(ark, 'Godkjent')) + e.range.getRow();
  var epost = (e.namedValues['E-post'] || [''])[0] ? ' (vil ha beskjed på e-post)' : '';
  varsle('Nytt arrangement til godkjenning: *' + slack(v[1]) + '*, ' + slack(v[2]) +
    (v[6] ? ', ' + slack(v[6]) : '') + epost + '\n<' + lenkje + '|Opne arket og kryss av i «Godkjent»>');
}

function varsle(tekst) {
  var svar = UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK'), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: tekst }),
    muteHttpExceptions: true
  });
  if (svar.getResponseCode() !== 200) throw new Error('Slack svarte ' + svar.getResponseCode() + ': ' + svar.getContentText());
}

// Innsend tekst skal ikkje kunne lage lenkjer eller varsle heile kanalen.
function slack(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Legg til det valfrie e-postfeltet, så vi kan gi innsendaren beskjed når
// arrangementet er ute. Køyr éin gong. Eit nytt spørsmål kan flytte
// «Godkjent» ei kolonne til høgre, og då ville den gamle formelen i
// «Publisert» gitt ei tom liste og tømt kalenderen. Difor blir formelen først
// skriven om med HSTACK og Col-namn, så han følgjer med når kolonnene flyttar
// seg, og lista blir kontrollert før og etter.
function leggTilEpost() {
  var ark = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ARK_ID'));
  var svar = svararket(ark), pub = ark.getSheetByName('Publisert'), a1 = pub.getRange('A1');
  var liste = function () { SpreadsheetApp.flush(); return JSON.stringify(pub.getDataRange().getDisplayValues()); };
  var opphavleg = liste(), gammal = a1.getFormula(), n = "'" + svar.getName() + "'!", g = bokstav(kolonne(svar, 'Godkjent'));
  a1.setFormula('=QUERY(HSTACK(' + n + 'A:K; ' + n + g + ':' + g + '); "' +
    'select Col1, Col2, Col3, Col4, Col5, Col6, Col7, Col8, Col9, Col10, Col11 where Col12 = true order by Col3 ' +
    "label Col1 'id', Col2 'tittel', Col3 'dato', Col4 'til', Col5 'start', Col6 'slutt', Col7 'stad', Col8 'arrangor', Col9 'lenkje', Col10 'omtale', Col11 'regel' " +
    "format Col1 'yyyy-mm-dd hh:mm:ss', Col3 'yyyy-mm-dd', Col4 'yyyy-mm-dd', Col5 'hh:mm', Col6 'hh:mm'\"; 1)");
  if (liste() !== opphavleg) {
    a1.setFormula(gammal);
    throw new Error('Den nye formelen gav ei anna liste, så den gamle er sett tilbake. Ingenting anna er endra.');
  }
  var skjema = FormApp.openByUrl(svar.getFormUrl());
  if (!skjema.getItems().some(function (i) { return i.getTitle() === 'E-post'; })) {
    skjema.addTextItem().setTitle('E-post')
      .setHelpText('Valfritt. Då gir vi deg beskjed når arrangementet er på nettsida. Adressa blir ikkje publisert, og vi slettar ho når arrangementet er over.')
      .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
    var d = skjema.getDescription(), ny = d.replace('Alt du skriv, kan bli publisert.', 'Alt du skriv, unntatt e-postadressa, kan bli publisert.');
    if (ny === d) Logger.log('Fann ikkje «Alt du skriv, kan bli publisert.» i skildringa til skjemaet. Rett ho for hand.');
    skjema.setDescription(ny);
  }
  Utilities.sleep(3000);
  if (liste() !== opphavleg) throw new Error('Lista i «Publisert» endra seg då e-postfeltet kom inn. Sjekk formelen i A1 før nokon godkjenner meir.');
  Logger.log('E-postfeltet er i kolonne ' + bokstav(kolonne(svar, 'E-post')) + ', og Godkjent er i ' + bokstav(kolonne(svar, 'Godkjent')) + '.');
  startAutoPublisering(); // tek med den daglege slettinga av e-postadresser
}

// Slettar e-postadressa dagen etter at arrangementet er over (dagleg trigger).
function ryddEpost() {
  var svar = svararket(SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ARK_ID')));
  var k = kolonne(svar, 'E-post'), n = svar.getLastRow() - 1;
  if (!k || n < 1) return;
  var datoar = svar.getRange(2, 3, n, 2).getValues(); // C dato, D til
  var epost = svar.getRange(2, k, n, 1).getValues(), idag = new Date(), endra = false;
  idag.setHours(0, 0, 0, 0);
  epost.forEach(function (rad, i) {
    var siste = datoar[i][1] || datoar[i][0];
    if (rad[0] && siste instanceof Date && siste < idag) { rad[0] = ''; endra = true; }
  });
  if (endra) svar.getRange(2, k, n, 1).setValues(epost);
}

function svararket(ark) {
  return ark.getSheets().filter(function (s) { return s.getFormUrl(); })[0];
}

// Kolonnenummeret (1, 2, ...) til ei overskrift i rad 1, eller 0 om ho ikkje finst.
function kolonne(ark, namn) {
  return ark.getRange(1, 1, 1, ark.getLastColumn()).getValues()[0].indexOf(namn) + 1;
}

// shortcut: berre A-Z, held så lenge arket har under 27 kolonner.
function bokstav(n) {
  return n ? String.fromCharCode(64 + n) : '?';
}
