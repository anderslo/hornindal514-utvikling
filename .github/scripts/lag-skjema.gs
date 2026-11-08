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
// har fått endringa. Timesjobben går som før om dette feilar.
//
// Oppsett éin gong i dette prosjektet: legg inn skripteigenskapane ARK_ID
// (id-en til reknearket) og GITHUB_TOKEN (fine-grained token med tilgang
// berre til hornindal514-utvikling og «Actions: Read and write»), og køyr
// startAutoPublisering. Køyr han på nytt når tokenet er bytt.
function startAutoPublisering() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'vedEndring') ScriptApp.deleteTrigger(t);
  });
  var arkId = PropertiesService.getScriptProperties().getProperty('ARK_ID');
  ScriptApp.newTrigger('vedEndring').forSpreadsheet(arkId).onEdit().create();
  publiser(); // prøver tokenet med ein gong
  Logger.log('Klart. Godkjende arrangement går no ut med ein gong.');
}

function vedEndring(e) {
  var r = e.range, ark = r.getSheet();
  if (!ark.getFormUrl() || r.getLastRow() < 2) return; // berre svara, ikkje overskrifta eller «Publisert»
  var fra = Math.max(r.getRow(), 2);
  var endraGodkjent = r.getColumn() <= 12 && r.getLastColumn() >= 12; // L er Godkjent
  var godkjendRad = ark.getRange(fra, 12, r.getLastRow() - fra + 1, 1).getValues()
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
