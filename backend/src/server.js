const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { db, avatarForIndex } = require('./db');

const app = express();
app.set('trust proxy', 1); // behind Caddy/Nginx, so req.secure reflects the real scheme
app.use(cors());
app.use(express.json());

// Staff web app (see /web) — served from the same origin as the API.
const WEB_DIR = path.join(__dirname, '..', '..', 'web');
app.use(express.static(WEB_DIR));

// ── auth ────────────────────────────────────────────────────────────────
// Single shared staff password (the app assumes a small trusted staff, not
// per-user accounts). Sessions are stateless HMAC-signed expiry tokens in an
// HttpOnly cookie, so they survive server restarts and changing the password
// invalidates every existing session.

const CLINIC_PASSWORD = process.env.CLINIC_PASSWORD || 'shreeji123';
if (!process.env.CLINIC_PASSWORD) {
  console.warn('WARNING: CLINIC_PASSWORD is not set — using the default dev password. Set it before exposing this server to the internet.');
}
const SESSION_COOKIE = 'shreeji_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const sessionSecret = crypto.createHash('sha256').update('shreeji-session:' + CLINIC_PASSWORD).digest();

function signSession(exp) {
  return exp + '.' + crypto.createHmac('sha256', sessionSecret).update(String(exp)).digest('base64url');
}
function verifySession(token) {
  const [expStr, sig] = String(token || '').split('.');
  if (!expStr || !sig || Number(expStr) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(expStr).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cookieValue(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
function isAuthed(req) {
  return verifySession(cookieValue(req, SESSION_COOKIE));
}

// Brute-force throttle: 10 attempts per IP per 15 minutes.
const loginAttempts = new Map();
function throttled(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

app.post('/api/login', (req, res) => {
  if (throttled(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  const given = crypto.createHash('sha256').update(String(req.body?.password ?? '')).digest();
  const actual = crypto.createHash('sha256').update(CLINIC_PASSWORD).digest();
  if (!crypto.timingSafeEqual(given, actual)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  loginAttempts.delete(req.ip);
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${signSession(Date.now() + SESSION_TTL_MS)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => res.json({ authenticated: isAuthed(req) }));

// Everything else under /api requires a signed-in session.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not signed in' });
});

// ── serialization helpers ──────────────────────────────────────────────

function serializeTreatment(row) {
  return { id: row.id, name: row.name, date: row.date, status: row.status, progress: row.progress };
}
function serializeInvoice(row) {
  return { id: row.id, description: row.description, date: row.date, amount: row.amount, paid: !!row.paid };
}
function serializeRx(row) {
  return { id: row.id, drug: row.drug, dosage: row.dosage, date: row.date };
}
function serializePhoto(row) {
  return { id: row.id, label: row.label };
}

const selectTreatments = db.prepare('SELECT * FROM treatments WHERE patient_id = ?');
const selectInvoices = db.prepare('SELECT * FROM invoices WHERE patient_id = ?');
const selectRx = db.prepare('SELECT * FROM prescriptions WHERE patient_id = ?');
const selectPhotos = db.prepare('SELECT * FROM photos WHERE patient_id = ?');

function serializePatient(row, { detail = false } = {}) {
  const invoices = selectInvoices.all(row.id).map(serializeInvoice);
  const balance = invoices.filter(i => !i.paid).reduce((sum, i) => sum + i.amount, 0);
  const base = {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    dob: row.dob,
    address: row.address,
    allergies: row.allergies,
    status: row.status,
    lastVisit: row.last_visit,
    medicalNotes: row.medical_notes,
    avatarBg: row.avatar_bg,
    avatarFg: row.avatar_fg,
    balance,
    pendingInvoiceCount: invoices.filter(i => !i.paid).length,
  };
  if (!detail) return base;
  return {
    ...base,
    treatments: selectTreatments.all(row.id).map(serializeTreatment),
    invoices,
    rx: selectRx.all(row.id).map(serializeRx),
    photos: selectPhotos.all(row.id).map(serializePhoto),
  };
}

function serializeAppointment(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    time: row.time,
    type: row.type,
    duration: row.duration,
    notes: row.notes,
  };
}

// ── patients ────────────────────────────────────────────────────────────

app.get('/api/patients', (req, res) => {
  const rows = db.prepare('SELECT * FROM patients ORDER BY created_at ASC').all();
  res.json(rows.map(r => serializePatient(r, { detail: true })));
});

app.get('/api/patients/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Patient not found' });
  res.json(serializePatient(row, { detail: true }));
});

app.post('/api/patients', (req, res) => {
  const { name, age, gender, phone, dob, address, allergies, medicalNotes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Please enter the patient’s name.' });
  }
  const count = db.prepare('SELECT COUNT(*) AS n FROM patients').get().n;
  const avatar = avatarForIndex(count);
  const id = 'p_' + crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO patients (id, name, age, gender, phone, dob, address, allergies, status, last_visit, medical_notes, avatar_bg, avatar_fg)
    VALUES (@id, @name, @age, @gender, @phone, @dob, @address, @allergies, 'new', @lastVisit, @medicalNotes, @avatarBg, @avatarFg)
  `).run({
    id,
    name: String(name).trim(),
    age: age || '—',
    gender: gender || 'Female',
    phone: phone || '—',
    dob: dob || '—',
    address: address || '—',
    allergies: allergies || 'None known',
    lastVisit: 'Today, ' + today,
    medicalNotes: medicalNotes || 'No notes yet.',
    avatarBg: avatar.bg,
    avatarFg: avatar.fg,
  });

  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  res.status(201).json(serializePatient(row, { detail: true }));
});

// ── appointments ────────────────────────────────────────────────────────

app.get('/api/appointments', (req, res) => {
  const { date } = req.query;
  const rows = date
    ? db.prepare('SELECT * FROM appointments WHERE date = ? ORDER BY time ASC').all(date)
    : db.prepare('SELECT * FROM appointments ORDER BY date ASC, time ASC').all();
  res.json(rows.map(serializeAppointment));
});

app.post('/api/appointments', (req, res) => {
  const { patientId, date, time, type, duration, notes } = req.body || {};
  if (!patientId) return res.status(400).json({ error: 'Please select a patient.' });
  const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(patientId);
  if (!patient) return res.status(400).json({ error: 'Please select a valid patient.' });

  const id = 'a_' + crypto.randomUUID();
  db.prepare(`
    INSERT INTO appointments (id, patient_id, date, time, type, duration, notes)
    VALUES (@id, @patientId, @date, @time, @type, @duration, @notes)
  `).run({
    id,
    patientId,
    date: date || new Date().toISOString().slice(0, 10),
    time: time || '10:00',
    type: type || 'Check-up',
    duration: Number(duration) || 30,
    notes: notes || '',
  });

  const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  res.status(201).json(serializeAppointment(row));
});

// ── invoices ────────────────────────────────────────────────────────────

app.patch('/api/invoices/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Invoice not found' });
  const paid = typeof req.body?.paid === 'boolean' ? req.body.paid : !row.paid;
  db.prepare('UPDATE invoices SET paid = ? WHERE id = ?').run(paid ? 1 : 0, req.params.id);
  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  res.json(serializeInvoice(updated));
});

// ── misc ────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Any other GET falls through to the web app's entry point.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Shreeji Smile Care API listening on http://localhost:${PORT}`);
});
