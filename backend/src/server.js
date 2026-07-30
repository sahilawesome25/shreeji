const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool, init, avatarForIndex } = require('./db');

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

// Loads patients (all, or one by id) with their child rows, using one query
// per table instead of per patient.
async function loadPatients(id = null) {
  const [patients] = id
    ? await pool.query('SELECT * FROM patients WHERE id = ?', [id])
    : await pool.query('SELECT * FROM patients ORDER BY seq ASC');
  if (patients.length === 0) return [];
  const ids = patients.map(p => p.id);

  const children = {};
  for (const table of ['treatments', 'invoices', 'prescriptions', 'photos']) {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE patient_id IN (?)`, [ids]);
    children[table] = rows;
  }
  const byPatient = (rows, pid) => rows.filter(r => r.patient_id === pid);

  return patients.map(row => {
    const invoices = byPatient(children.invoices, row.id).map(serializeInvoice);
    return {
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
      balance: invoices.filter(i => !i.paid).reduce((sum, i) => sum + i.amount, 0),
      pendingInvoiceCount: invoices.filter(i => !i.paid).length,
      treatments: byPatient(children.treatments, row.id).map(serializeTreatment),
      invoices,
      rx: byPatient(children.prescriptions, row.id).map(serializeRx),
      photos: byPatient(children.photos, row.id).map(serializePhoto),
    };
  });
}

// Express 4 doesn't catch async errors on its own.
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

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

app.get('/api/patients', wrap(async (req, res) => {
  res.json(await loadPatients());
}));

app.get('/api/patients/:id', wrap(async (req, res) => {
  const [patient] = await loadPatients(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
}));

app.post('/api/patients', wrap(async (req, res) => {
  const { name, age, gender, phone, dob, address, allergies, medicalNotes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Please enter the patient’s name.' });
  }
  const [[{ n: count }]] = await pool.query('SELECT COUNT(*) AS n FROM patients');
  const avatar = avatarForIndex(count);
  const id = 'p_' + crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  await pool.query(`
    INSERT INTO patients (id, name, age, gender, phone, dob, address, allergies, status, last_visit, medical_notes, avatar_bg, avatar_fg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)
  `, [
    id,
    String(name).trim(),
    age || '—',
    gender || 'Female',
    phone || '—',
    dob || '—',
    address || '—',
    allergies || 'None known',
    'Today, ' + today,
    medicalNotes || 'No notes yet.',
    avatar.bg,
    avatar.fg,
  ]);

  const [patient] = await loadPatients(id);
  res.status(201).json(patient);
}));

// ── appointments ────────────────────────────────────────────────────────

app.get('/api/appointments', wrap(async (req, res) => {
  const { date } = req.query;
  const [rows] = date
    ? await pool.query('SELECT * FROM appointments WHERE date = ? ORDER BY time ASC', [date])
    : await pool.query('SELECT * FROM appointments ORDER BY date ASC, time ASC');
  res.json(rows.map(serializeAppointment));
}));

app.post('/api/appointments', wrap(async (req, res) => {
  const { patientId, date, time, type, duration, notes } = req.body || {};
  if (!patientId) return res.status(400).json({ error: 'Please select a patient.' });
  const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (!patient) return res.status(400).json({ error: 'Please select a valid patient.' });

  const id = 'a_' + crypto.randomUUID();
  await pool.query(`
    INSERT INTO appointments (id, patient_id, date, time, type, duration, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    patientId,
    date || new Date().toISOString().slice(0, 10),
    time || '10:00',
    type || 'Check-up',
    Number(duration) || 30,
    notes || '',
  ]);

  const [[row]] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
  res.status(201).json(serializeAppointment(row));
}));

// ── invoices ────────────────────────────────────────────────────────────

app.patch('/api/invoices/:id', wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Invoice not found' });
  const paid = typeof req.body?.paid === 'boolean' ? req.body.paid : !row.paid;
  await pool.query('UPDATE invoices SET paid = ? WHERE id = ?', [paid ? 1 : 0, req.params.id]);
  const [[updated]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  res.json(serializeInvoice(updated));
}));

// ── misc ────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Any other GET falls through to the web app's entry point.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Shreeji Smile Care API listening on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('Could not initialize the database:', e.message);
    process.exit(1);
  });
