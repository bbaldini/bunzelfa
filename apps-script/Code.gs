/**
 * Bunzelfa – la casella postale delle letterine.
 * Da incollare in un Google Sheet: Estensioni → Apps Script.
 * Ogni persona ha il suo foglio (Lorenzo, Benny, Ros, Lola).
 */
const FAMILY_KEY = 'FAMILY_KEY_QUI';   // uguale a "key" in config.js della app
const ADMIN_KEY  = 'ADMIN_KEY_QUI';    // solo per la dashboard sul Desktop: non condividerla
const PEOPLE = ['Lorenzo', 'Benny', 'Ros', 'Lola'];
const HEADER = ['Data', 'Tipo', 'Testo', 'Link', 'ID invio'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'formato' }); }
  if (!d || d.key !== FAMILY_KEY) return json_({ ok: false, error: 'chiave' });
  const name = PEOPLE.indexOf(d.name) >= 0 ? d.name : 'Altro';
  const id = String(d.id || Utilities.getUuid()).slice(0, 64);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheetFor_(name);
    // già ricevuta? (l'app ritenta se la rete cade)
    if (sh.getLastRow() > 1 && sh.getRange(2, 5, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext()) {
      return json_({ ok: true, duplicate: true });
    }
    const now = new Date();
    let rows = [];
    if (d.type === 'letter' && Array.isArray(d.wishes)) {
      rows = d.wishes.slice(0, 30).map(w => [now, 'Desiderio', clean_(w && w.text, 200), link_(w && w.link), id]);
    } else if (d.type === 'message') {
      rows = [[now, 'Messaggino', clean_(d.text, 1500), '', id]];
    }
    if (!rows.length) return json_({ ok: false, error: 'vuota' });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    return json_({ ok: true, saved: rows.length });
  } finally {
    lock.releaseLock();
  }
}

// Lettura per la dashboard: ?admin=ADMIN_KEY  (con &callback=fn risponde in JSONP)
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.admin !== ADMIN_KEY) return out_({ ok: false, error: 'chiave' }, p.callback);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const people = {};
  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    if (sh.getLastRow() < 2 || sh.getRange(1, 1).getValue() !== 'Data') return;
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, HEADER.length).getValues();
    people[n] = vals.map(r => ({
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      type: r[1] === 'Messaggino' ? 'message' : 'wish',
      text: String(r[2]).replace(/^'/, ''), link: String(r[3]), id: String(r[4])
    }));
  });
  return out_({ ok: true, people: people, order: PEOPLE }, p.callback);
}

function sheetFor_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight('bold').setBackground('#c8243a').setFontColor('#ffffff');
    sh.setColumnWidth(1, 150); sh.setColumnWidth(3, 360); sh.setColumnWidth(4, 260); sh.hideColumns(5);
  }
  return sh;
}
function clean_(s, max) {
  s = String(s == null ? '' : s).slice(0, max).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // niente formule iniettate nel foglio
}
function link_(s) {
  s = String(s || '').trim().slice(0, 600);
  return /^https?:\/\/[^\s"]+$/i.test(s) ? s : '';
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function out_(o, cb) {
  if (cb && /^[A-Za-z_$][\w$]{0,40}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(o) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(o);
}

// Esegui una volta dall'editor per creare i 4 fogli e autorizzare lo script.
function setup() { PEOPLE.forEach(sheetFor_); }
