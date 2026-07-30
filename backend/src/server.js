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
  return { id: row.id, label: row.label, hasImage: !!row.mime };
}

// "Jul 30"-style display date, matching the seed data's date strings.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function displayDateToday() {
  const d = new Date();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
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
  for (const table of ['treatments', 'invoices', 'prescriptions']) {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE patient_id IN (?)`, [ids]);
    children[table] = rows;
  }
  // Never pull the image blobs into list responses.
  const [photoRows] = await pool.query('SELECT id, patient_id, label, mime FROM photos WHERE patient_id IN (?)', [ids]);
  children.photos = photoRows;
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

app.patch('/api/patients/:id', wrap(async (req, res) => {
  const [[existing]] = await pool.query('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Patient not found' });
  const { name, age, gender, phone, dob, address, allergies, medicalNotes } = req.body || {};
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Please enter the patient’s name.' });
  }
  const columns = {
    name: name !== undefined ? String(name).trim() : undefined,
    age, gender, phone, dob, address, allergies,
    medical_notes: medicalNotes,
  };
  const sets = [];
  const values = [];
  for (const [col, value] of Object.entries(columns)) {
    if (value !== undefined) { sets.push(`${col} = ?`); values.push(value); }
  }
  if (sets.length) {
    await pool.query(`UPDATE patients SET ${sets.join(', ')} WHERE id = ?`, [...values, req.params.id]);
  }
  const [patient] = await loadPatients(req.params.id);
  res.json(patient);
}));

app.delete('/api/patients/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM patients WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Patient not found' });
  res.json({ ok: true });
}));

// ── treatments ──────────────────────────────────────────────────────────

app.post('/api/patients/:id/treatments', wrap(async (req, res) => {
  const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const { name, status, progress } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Please enter the treatment name.' });
  const id = 't_' + crypto.randomUUID();
  await pool.query('INSERT INTO treatments (id, patient_id, name, date, status, progress) VALUES (?, ?, ?, ?, ?, ?)', [
    id, req.params.id, String(name).trim(), displayDateToday(),
    status || 'Planned',
    Math.min(100, Math.max(0, Number(progress) || 0)),
  ]);
  const [[row]] = await pool.query('SELECT * FROM treatments WHERE id = ?', [id]);
  res.status(201).json(serializeTreatment(row));
}));

app.patch('/api/treatments/:id', wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT * FROM treatments WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Treatment not found' });
  const { status, progress } = req.body || {};
  await pool.query('UPDATE treatments SET status = ?, progress = ? WHERE id = ?', [
    status || row.status,
    progress !== undefined ? Math.min(100, Math.max(0, Number(progress) || 0)) : row.progress,
    req.params.id,
  ]);
  const [[updated]] = await pool.query('SELECT * FROM treatments WHERE id = ?', [req.params.id]);
  res.json(serializeTreatment(updated));
}));

app.delete('/api/treatments/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM treatments WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Treatment not found' });
  res.json({ ok: true });
}));

// ── prescriptions ───────────────────────────────────────────────────────

app.post('/api/patients/:id/rx', wrap(async (req, res) => {
  const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const { drug, dosage } = req.body || {};
  if (!drug || !String(drug).trim()) return res.status(400).json({ error: 'Please enter the medicine name.' });
  const id = 'r_' + crypto.randomUUID();
  await pool.query('INSERT INTO prescriptions (id, patient_id, drug, dosage, date) VALUES (?, ?, ?, ?, ?)', [
    id, req.params.id, String(drug).trim(), dosage || '', displayDateToday(),
  ]);
  const [[row]] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [id]);
  res.status(201).json(serializeRx(row));
}));

app.delete('/api/rx/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM prescriptions WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Prescription not found' });
  res.json({ ok: true });
}));

// ── photos ──────────────────────────────────────────────────────────────

app.post('/api/patients/:id/photos', express.raw({ type: 'image/*', limit: '8mb' }), wrap(async (req, res) => {
  const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'No image received.' });
  }
  const label = String(req.query.label || '').trim() || `Photo · ${displayDateToday()}`;
  const id = 'ph_' + crypto.randomUUID();
  await pool.query('INSERT INTO photos (id, patient_id, label, mime, data) VALUES (?, ?, ?, ?, ?)', [
    id, req.params.id, label.slice(0, 200), req.headers['content-type'], req.body,
  ]);
  res.status(201).json({ id, label: label.slice(0, 200), hasImage: true });
}));

app.get('/api/photos/:id/image', wrap(async (req, res) => {
  const [[row]] = await pool.query('SELECT mime, data FROM photos WHERE id = ?', [req.params.id]);
  if (!row || !row.data) return res.status(404).json({ error: 'Photo not found' });
  res.setHeader('Content-Type', row.mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(row.data);
}));

app.delete('/api/photos/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM photos WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Photo not found' });
  res.json({ ok: true });
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

app.post('/api/patients/:id/invoices', wrap(async (req, res) => {
  const [[patient]] = await pool.query('SELECT id FROM patients WHERE id = ?', [req.params.id]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const { description, amount } = req.body || {};
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'Please enter a description.' });
  }
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Please enter a valid amount.' });
  }
  const id = 'i_' + crypto.randomUUID();
  await pool.query('INSERT INTO invoices (id, patient_id, description, date, amount, paid) VALUES (?, ?, ?, ?, ?, 0)', [
    id, req.params.id, String(description).trim(), displayDateToday(), amt,
  ]);
  const [[row]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);
  res.status(201).json(serializeInvoice(row));
}));

app.delete('/api/invoices/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ ok: true });
}));

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
