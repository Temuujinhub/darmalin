// RFQ (Request for Quotation) — server-side validation and helpers.
// Pure functions: the browser validates for convenience, this module is
// the authority. Option lists must stay in sync with public/contact.html.

export const PRODUCTS = [
  'Gasoline RON 92',
  'Gasoline RON 95',
  'Diesel EN590 10 ppm (ULSD)',
  'Gasoil 50–5000 ppm',
  'Jet Fuel A-1',
  'Fuel Oil 180 / 380 CST',
  'VLSFO 0.5%',
  'Crude Oil',
  'LPG (Propane / Butane)',
  'Bitumen 60/70 · 80/100',
  'Base Oils (SN 150 / SN 500)',
  'Naphtha / Petrochemicals',
  'Other (specify in notes)',
];
export const ORDER_TYPES = ['Spot Purchase', 'Term Contract'];
export const UNITS = ['MT', 'Barrels', 'Gallons'];
export const INCOTERMS = ['FOB', 'CIF', 'CFR', 'DAP'];
export const PAYMENTS = ['DLC', 'SBLC', 'MT103 / TT'];
export const BUYER_ROLES = ['End-buyer', 'Distributor', 'Trader'];

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'mail.ru', 'yandex.ru', 'yandex.com', 'qq.com', '163.com', '126.com', 'gmx.com', 'gmx.net',
]);

const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

function text(v, max) {
  if (v == null) return '';
  // strip control characters, collapse whitespace runs (newlines kept for notes)
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function emailDomain(email) {
  const m = EMAIL_RE.exec(String(email || '').trim());
  return m ? m[1].toLowerCase() : null;
}

export function isFreeMail(domain) {
  return FREE_MAIL.has(String(domain || '').toLowerCase());
}

// Phone in international format: "+" then 8–15 digits (E.164).
export function normalizePhone(v) {
  const s = String(v || '').replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

// Identify an upload by its leading bytes, not by what the browser claims.
export function sniffFile(bytes) {
  if (!bytes || bytes.length < 8) return null;
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';          // %PDF
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'docx';         // PK.. (OOXML zip)
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'doc';          // legacy Office
  return null;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Returns { ok, errors: {field: message}, clean }.
export function validateRfq(body) {
  const errors = {};
  const b = body && typeof body === 'object' ? body : {};
  const clean = {};

  clean.product = text(b.product, 80);
  if (!PRODUCTS.includes(clean.product)) errors.product = 'Select a product.';

  clean.orderType = text(b.orderType, 30);
  if (!ORDER_TYPES.includes(clean.orderType)) errors.orderType = 'Choose spot purchase or term contract.';

  const qty = typeof b.quantity === 'number' ? b.quantity : parseFloat(String(b.quantity || '').replace(/,/g, ''));
  if (!isFinite(qty) || qty <= 0 || qty > 1e9) errors.quantity = 'Enter a quantity greater than zero.';
  else clean.quantity = Math.round(qty * 1000) / 1000;

  clean.unit = text(b.unit, 12);
  if (!UNITS.includes(clean.unit)) errors.unit = 'Select a unit.';

  clean.incoterm = text(b.incoterm, 6);
  if (!INCOTERMS.includes(clean.incoterm)) errors.incoterm = 'Select delivery terms.';

  clean.destination = text(b.destination, 120);
  if (clean.incoterm && clean.incoterm !== 'FOB' && clean.destination.length < 2) {
    errors.destination = 'Destination port or country is needed for ' + clean.incoterm + ' delivery.';
  }

  clean.payment = text(b.payment, 20);
  if (!PAYMENTS.includes(clean.payment)) errors.payment = 'Select a payment method.';

  clean.company = text(b.company, 120);
  if (clean.company.length < 2) errors.company = 'Enter your company name.';

  clean.buyerRole = text(b.buyerRole, 20);
  if (!BUYER_ROLES.includes(clean.buyerRole)) errors.buyerRole = 'Select your role.';

  clean.contactName = text(b.contactName, 80);
  if (clean.contactName.length < 2) errors.contactName = 'Enter the contact person\'s name.';

  clean.email = text(b.email, 254).toLowerCase();
  const domain = emailDomain(clean.email);
  if (!domain) errors.email = 'Enter a valid email address.';
  else {
    clean.emailDomain = domain;
    clean.emailType = isFreeMail(domain) ? 'Free mail' : 'Corporate';
  }

  const phone = normalizePhone(b.phone);
  if (!phone) errors.phone = 'Enter the number with country code, e.g. +971 52 352 7887.';
  else clean.phone = phone;

  clean.notes = text(b.notes, 2000);

  if (b.file && typeof b.file === 'object' && b.file.data) {
    const name = text(b.file.name, 120).replace(/[\\/:*?"<>|]/g, '_');
    const ext = (name.split('.').pop() || '').toLowerCase();
    let bytes = null;
    try { bytes = base64ToBytes(String(b.file.data)); } catch (e) { bytes = null; }
    if (!bytes) errors.file = 'The attachment could not be read.';
    else if (bytes.length > MAX_FILE_BYTES) errors.file = 'Attachment is larger than 5 MB.';
    else {
      const kind = sniffFile(bytes);
      const extOk = (kind === 'pdf' && ext === 'pdf') || (kind === 'docx' && ext === 'docx') || (kind === 'doc' && ext === 'doc');
      if (!extOk) errors.file = 'Attach a PDF or Word document (.pdf, .docx, .doc).';
      else clean.file = { name, kind, size: bytes.length, data: String(b.file.data) };
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, clean };
}

// RFQ-YYYYMMDD-XXXX; the suffix avoids look-alike characters.
export function makeRef(now, randomBytes) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[randomBytes[i] % alphabet.length];
  return 'RFQ-' + d + '-' + s;
}
