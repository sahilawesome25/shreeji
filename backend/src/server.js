const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { db, avatarForIndex } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Shreeji Smile Care API listening on http://localhost:${PORT}`);
});
