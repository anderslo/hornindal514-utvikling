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
    .setDescription('Arrangement i Hornindal til kalenderen på Kva skjer-sida til Hornindal 514 Utvikling. Vi ser over alt før det kjem i kalenderen. Alt du skriv, kan bli publisert. Personvern: https://anderslo.github.io/hornindal514-utvikling/personvern.html#arrangement')
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
