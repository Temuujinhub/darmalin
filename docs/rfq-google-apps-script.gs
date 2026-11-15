/**
 * DAR AL RIMAL — RFQ inbox (Google Apps Script, bound to a Google Sheet)
 *
 * Receives each Request for Quotation from the website (via the Cloudflare
 * Worker at /api/rfq), appends it as a row to the "RFQ Inbox" tab, saves
 * any attached LOI/spec file to a Drive folder, and emails a notification.
 *
 * Setup (once):
 *   1. Create a Google Sheet, then Extensions → Apps Script.
 *   2. Replace the default code with this whole file and Save.
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Authorize when asked, then copy the Web app URL.
 *   4. In Cloudflare: Workers & Pages → darmalin → Settings →
 *      Runtime variables and secrets → add a Secret named RFQ_WEBHOOK_URL
 *      with that URL as the value → Deploy.
 *
 * After editing this script later, use Deploy → Manage deployments → Edit →
 * Version: New version, so the same URL keeps working.
 */

// Where "new RFQ" alerts are emailed. Set to '' to switch alerts off.
var NOTIFY_EMAIL = 'info@dar-rimal.ae';

var SHEET_NAME = 'RFQ Inbox';
var UPLOAD_FOLDER = 'Dar Al Rimal — RFQ Attachments';

var COLUMNS = [
  ['Received (Dubai time)', function (d) { return Utilities.formatDate(new Date(d.receivedAt), 'Asia/Dubai', 'yyyy-MM-dd HH:mm'); }],
  ['Reference',             function (d) { return d.ref; }],
  ['Status',                function ()  { return 'New'; }],
  ['Product',               function (d) { return d.product; }],
  ['Order type',            function (d) { return d.orderType; }],
  ['Quantity',              function (d) { return d.quantity; }],
  ['Unit',                  function (d) { return d.unit; }],
  ['Incoterm',              function (d) { return d.incoterm; }],
  ['Destination',           function (d) { return d.destination; }],
  ['Payment',               function (d) { return d.payment; }],
  ['Company',               function (d) { return d.company; }],
  ['Buyer role',            function (d) { return d.buyerRole; }],
  ['Contact person',        function (d) { return d.contactName; }],
  ['Email',                 function (d) { return d.email; }],
  ['Email type',            function (d) { return d.emailType; }],
  ['Phone / WhatsApp',      function (d) { return d.phone; }],
  ['Attachment',            function (d) { return d.fileUrl; }],
  ['Notes',                 function (d) { return d.notes; }],
  ['Submitted from',        function (d) { return d.country; }]
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || !d.ref || !d.company || !d.email) throw new Error('incomplete request');

    // The row is what matters: a failed upload or alert must not lose the lead.
    try { d.fileUrl = saveAttachment_(d); }
    catch (fileErr) { d.fileUrl = 'Attachment could not be saved — ask the buyer to resend'; }

    var sheet = getSheet_();
    var row = COLUMNS.map(function (c) { return safeCell_(c[1](d)); });
    sheet.appendRow(row);

    try { notify_(d); } catch (mailErr) { /* row is saved; alert skipped */ }
    return reply_({ ok: true, ref: d.ref });
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser shows that it is alive.
function doGet() {
  return reply_({ ok: true, service: 'Dar Al Rimal RFQ inbox' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME, 0);
  if (sheet.getLastRow() === 0) {
    var headers = COLUMNS.map(function (c) { return c[0]; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0a192f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Text that starts with = + - @ would be run as a formula by Sheets;
// a leading apostrophe stores it as plain text (the apostrophe is not shown).
function safeCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  var s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function saveAttachment_(d) {
  if (!d.file || !d.file.data) return '';
  var mime = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword'
  }[d.file.kind];
  if (!mime) return '';
  var folders = DriveApp.getFoldersByName(UPLOAD_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(UPLOAD_FOLDER);
  var blob = Utilities.newBlob(Utilities.base64Decode(d.file.data), mime, d.ref + ' — ' + d.file.name);
  return folder.createFile(blob).getUrl();
}

function notify_(d) {
  if (!NOTIFY_EMAIL) return;
  var lines = [
    'New Request for Quotation — ' + d.ref,
    '',
    'Product:      ' + d.product,
    'Order type:   ' + d.orderType,
    'Quantity:     ' + d.quantity + ' ' + d.unit,
    'Incoterm:     ' + d.incoterm,
    'Destination:  ' + (d.destination || '—'),
    'Payment:      ' + d.payment,
    '',
    'Company:      ' + d.company + ' (' + d.buyerRole + ')',
    'Contact:      ' + d.contactName,
    'Email:        ' + d.email + ' [' + d.emailType + ']',
    'Phone/WA:     ' + d.phone,
    'Attachment:   ' + (d.fileUrl || '—'),
    '',
    'Notes:',
    d.notes || '—',
    '',
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ];
  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: d.email,
    subject: 'RFQ ' + d.ref + ' — ' + d.product + ' — ' + d.company,
    body: lines.join('\n')
  });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
