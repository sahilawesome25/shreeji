const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'clinic.sqlite3');
const isNewDb = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age TEXT,
    gender TEXT,
    phone TEXT,
    dob TEXT,
    address TEXT,
    allergies TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_visit TEXT,
    medical_notes TEXT,
    avatar_bg TEXT NOT NULL,
    avatar_fg TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS treatments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date TEXT,
    status TEXT NOT NULL DEFAULT 'Planned',
    progress INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    date TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    drug TEXT NOT NULL,
    dosage TEXT,
    date TEXT
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    label TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
  CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
  CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
  CREATE INDEX IF NOT EXISTS idx_photos_patient ON photos(patient_id);
`);

// Same avatar palette as the design prototype's AVATAR_PALETTE.
const AVATAR_PALETTE = [
  { bg: '#c8e5e4', fg: '#004e4e' },
  { bg: '#f4e3bf', fg: '#523400' },
  { bg: '#d3e3f5', fg: '#213c59' },
  { bg: '#fedbd5', fg: '#6a2d24' },
];

function avatarForIndex(i) {
  return AVATAR_PALETTE[i % AVATAR_PALETTE.length];
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Seeds the database with the same demo data used in the Claude Design
// prototype (Shreeji Smile Care.dc.html), so the app is populated on first run.
function seed() {
  const TODAY = todayIso();

  const patients = [
    { id: 'p1', name: 'Aarav Shah', age: '34', gender: 'Male', phone: '+91 98200 11223', dob: '1992-03-14',
      address: 'B-12 Shreeji Nagar, Ahmedabad', allergies: 'Penicillin sensitivity', status: 'active', lastVisit: 'Jul 18',
      medicalNotes: 'Mild gum recession, upper molars. Recommend soft-bristle brush.',
      treatments: [
        { id: 't1', name: 'Root Canal — Tooth #36', date: 'Jun 20', status: 'In Progress', progress: 60 },
        { id: 't2', name: 'Scaling & Polishing', date: 'Jul 18', status: 'Completed', progress: 100 },
      ],
      invoices: [
        { id: 'i1', description: 'Root Canal — Session 2', date: 'Jul 18', amount: 4500, paid: false },
        { id: 'i2', description: 'Consultation', date: 'Jun 20', amount: 500, paid: true },
      ],
      rx: [{ id: 'r1', drug: 'Amoxicillin 500mg', dosage: '1 tab, 3x/day, 5 days', date: 'Jun 20' }],
      photos: [{ id: 'ph1', label: 'X-ray · pre-op' }, { id: 'ph2', label: 'Intraoral · #36' }],
    },
    { id: 'p2', name: 'Priya Nair', age: '27', gender: 'Female', phone: '+91 98250 44556', dob: '1999-07-02',
      address: '204 Lotus Apts, Vastrapur', allergies: 'None known', status: 'new', lastVisit: 'Jul 27',
      medicalNotes: 'First visit. Interested in orthodontic consult.',
      treatments: [{ id: 't3', name: 'Orthodontic Consultation', date: 'Jul 27', status: 'Planned', progress: 10 }],
      invoices: [{ id: 'i3', description: 'New Patient Consultation', date: 'Jul 27', amount: 800, paid: false }],
      rx: [],
      photos: [{ id: 'ph3', label: 'Intraoral · full arch' }],
    },
    { id: 'p3', name: 'Rohan Mehta', age: '45', gender: 'Male', phone: '+91 99040 77889', dob: '1981-11-09',
      address: '5 Sarvodaya Society, Navrangpura', allergies: 'Latex allergy', status: 'active', lastVisit: 'Jul 25',
      medicalNotes: 'Crown placed on #14, monitor bite alignment.',
      treatments: [{ id: 't4', name: 'Crown — Tooth #14', date: 'Jul 10', status: 'Completed', progress: 100 }],
      invoices: [
        { id: 'i4', description: 'Ceramic Crown', date: 'Jul 10', amount: 12000, paid: false },
        { id: 'i5', description: 'Follow-up X-ray', date: 'Jul 25', amount: 350, paid: true },
      ],
      rx: [{ id: 'r2', drug: 'Ibuprofen 400mg', dosage: 'As needed for pain', date: 'Jul 10' }],
      photos: [{ id: 'ph4', label: 'X-ray · #14 post-op' }],
    },
    { id: 'p4', name: 'Sneha Joshi', age: '19', gender: 'Female', phone: '+91 97120 33445', dob: '2007-01-22',
      address: '11 Kalyan Society, Naranpura', allergies: 'None known', status: 'active', lastVisit: 'Jul 15',
      medicalNotes: 'Braces adjustment monthly. Good compliance.',
      treatments: [{ id: 't5', name: 'Orthodontic Braces', date: 'Feb 5', status: 'In Progress', progress: 40 }],
      invoices: [{ id: 'i6', description: 'Monthly Adjustment', date: 'Jul 15', amount: 1500, paid: true }],
      rx: [],
      photos: [{ id: 'ph5', label: 'Intraoral · braces check' }, { id: 'ph6', label: 'Progress photo' }],
    },
    { id: 'p5', name: 'Kunal Desai', age: '58', gender: 'Male', phone: '+91 90540 22110', dob: '1968-05-30',
      address: '9 Shantivan Society, Paldi', allergies: 'Hypertension — avoid epinephrine-heavy anesthesia', status: 'active', lastVisit: 'Jul 29',
      medicalNotes: 'Extraction healing well. Implant consult scheduled.',
      treatments: [
        { id: 't6', name: 'Tooth Extraction — #26', date: 'Jul 15', status: 'Completed', progress: 100 },
        { id: 't7', name: 'Dental Implant — #26', date: 'Jul 29', status: 'Planned', progress: 5 },
      ],
      invoices: [{ id: 'i7', description: 'Extraction Procedure', date: 'Jul 15', amount: 3000, paid: false }],
      rx: [{ id: 'r3', drug: 'Amoxicillin 500mg', dosage: '1 tab, 2x/day, 5 days', date: 'Jul 15' }],
      photos: [{ id: 'ph7', label: 'X-ray · pre-extraction' }],
    },
    { id: 'p6', name: 'Meera Iyer', age: '31', gender: 'Female', phone: '+91 98980 55667', dob: '1995-09-17',
      address: '3 Green Valley, Bodakdev', allergies: 'None known', status: 'active', lastVisit: 'Jul 22',
      medicalNotes: 'Teeth whitening completed, satisfied with results.',
      treatments: [{ id: 't8', name: 'Teeth Whitening', date: 'Jul 22', status: 'Completed', progress: 100 }],
      invoices: [{ id: 'i8', description: 'Whitening Session', date: 'Jul 22', amount: 6000, paid: true }],
      rx: [],
      photos: [{ id: 'ph8', label: 'Before whitening' }, { id: 'ph9', label: 'After whitening' }],
    },
  ];

  const appointments = [
    { id: 'a1', patientId: 'p1', date: TODAY, time: '09:30', type: 'Root Canal — Session 2', duration: 45, notes: '' },
    { id: 'a2', patientId: 'p2', date: TODAY, time: '11:00', type: 'Orthodontic Consultation', duration: 30, notes: '' },
    { id: 'a3', patientId: 'p5', date: TODAY, time: '15:00', type: 'Implant Consult', duration: 30, notes: '' },
    { id: 'a4', patientId: 'p3', date: addDaysIso(TODAY, 1), time: '10:00', type: 'Bite Check', duration: 20, notes: '' },
    { id: 'a5', patientId: 'p4', date: addDaysIso(TODAY, 2), time: '13:30', type: 'Braces Adjustment', duration: 30, notes: '' },
  ];

  const insertPatient = db.prepare(`
    INSERT INTO patients (id, name, age, gender, phone, dob, address, allergies, status, last_visit, medical_notes, avatar_bg, avatar_fg)
    VALUES (@id, @name, @age, @gender, @phone, @dob, @address, @allergies, @status, @lastVisit, @medicalNotes, @avatarBg, @avatarFg)
  `);
  const insertTreatment = db.prepare(`
    INSERT INTO treatments (id, patient_id, name, date, status, progress) VALUES (@id, @patientId, @name, @date, @status, @progress)
  `);
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, patient_id, description, date, amount, paid) VALUES (@id, @patientId, @description, @date, @amount, @paid)
  `);
  const insertRx = db.prepare(`
    INSERT INTO prescriptions (id, patient_id, drug, dosage, date) VALUES (@id, @patientId, @drug, @dosage, @date)
  `);
  const insertPhoto = db.prepare(`
    INSERT INTO photos (id, patient_id, label) VALUES (@id, @patientId, @label)
  `);
  const insertAppt = db.prepare(`
    INSERT INTO appointments (id, patient_id, date, time, type, duration, notes) VALUES (@id, @patientId, @date, @time, @type, @duration, @notes)
  `);

  const seedTxn = db.transaction(() => {
    patients.forEach((p, idx) => {
      const avatar = avatarForIndex(idx);
      insertPatient.run({ ...p, avatarBg: avatar.bg, avatarFg: avatar.fg });
      p.treatments.forEach(t => insertTreatment.run({ ...t, patientId: p.id }));
      p.invoices.forEach(inv => insertInvoice.run({ ...inv, patientId: p.id, paid: inv.paid ? 1 : 0 }));
      p.rx.forEach(r => insertRx.run({ ...r, patientId: p.id }));
      p.photos.forEach(ph => insertPhoto.run({ ...ph, patientId: p.id }));
    });
    appointments.forEach(a => insertAppt.run(a));
  });
  seedTxn();
}

if (isNewDb) {
  seed();
}

module.exports = { db, AVATAR_PALETTE, avatarForIndex, todayIso, addDaysIso };
