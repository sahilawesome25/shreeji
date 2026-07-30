const mysql = require('mysql2/promise');

// Connection settings: DATABASE_URL (mysql://user:pass@host:port/dbname) wins,
// otherwise individual MYSQL_* variables, otherwise local-dev defaults that
// match the README's development setup.
const pool = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'shreeji',
      password: process.env.MYSQL_PASSWORD || 'shreeji_dev',
      database: process.env.MYSQL_DATABASE || 'shreeji',
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4',
    });

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    seq INT NOT NULL AUTO_INCREMENT UNIQUE,
    name VARCHAR(200) NOT NULL,
    age VARCHAR(10),
    gender VARCHAR(20),
    phone VARCHAR(40),
    dob VARCHAR(20),
    address VARCHAR(300),
    allergies VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_visit VARCHAR(40),
    medical_notes TEXT,
    avatar_bg VARCHAR(10) NOT NULL,
    avatar_fg VARCHAR(10) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    date VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'Planned',
    progress INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_treatments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    description VARCHAR(300) NOT NULL,
    date VARCHAR(20),
    amount INT NOT NULL DEFAULT 0,
    paid TINYINT(1) NOT NULL DEFAULT 0,
    CONSTRAINT fk_invoices_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS prescriptions (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    drug VARCHAR(200) NOT NULL,
    dosage VARCHAR(200),
    date VARCHAR(20),
    CONSTRAINT fk_prescriptions_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    label VARCHAR(200) NOT NULL,
    CONSTRAINT fk_photos_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL,
    date VARCHAR(10) NOT NULL,
    time VARCHAR(5) NOT NULL,
    type VARCHAR(100) NOT NULL,
    duration INT NOT NULL DEFAULT 30,
    notes TEXT,
    INDEX idx_appointments_date (date),
    CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  )`,
];

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
async function seed() {
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [idx, p] of patients.entries()) {
      const avatar = avatarForIndex(idx);
      await conn.query(
        `INSERT INTO patients (id, name, age, gender, phone, dob, address, allergies, status, last_visit, medical_notes, avatar_bg, avatar_fg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.age, p.gender, p.phone, p.dob, p.address, p.allergies, p.status, p.lastVisit, p.medicalNotes, avatar.bg, avatar.fg]);
      for (const t of p.treatments) {
        await conn.query('INSERT INTO treatments (id, patient_id, name, date, status, progress) VALUES (?, ?, ?, ?, ?, ?)',
          [t.id, p.id, t.name, t.date, t.status, t.progress]);
      }
      for (const inv of p.invoices) {
        await conn.query('INSERT INTO invoices (id, patient_id, description, date, amount, paid) VALUES (?, ?, ?, ?, ?, ?)',
          [inv.id, p.id, inv.description, inv.date, inv.amount, inv.paid ? 1 : 0]);
      }
      for (const r of p.rx) {
        await conn.query('INSERT INTO prescriptions (id, patient_id, drug, dosage, date) VALUES (?, ?, ?, ?, ?)',
          [r.id, p.id, r.drug, r.dosage, r.date]);
      }
      for (const ph of p.photos) {
        await conn.query('INSERT INTO photos (id, patient_id, label) VALUES (?, ?, ?)', [ph.id, p.id, ph.label]);
      }
    }
    for (const a of appointments) {
      await conn.query('INSERT INTO appointments (id, patient_id, date, time, type, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [a.id, a.patientId, a.date, a.time, a.type, a.duration, a.notes]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Creates tables and seeds demo data on an empty database. Must complete
// before the server starts accepting requests.
async function init() {
  for (const stmt of SCHEMA) await pool.query(stmt);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM patients');
  if (n === 0) {
    await seed();
    console.log('Seeded database with demo patients and appointments.');
  }
}

module.exports = { pool, init, AVATAR_PALETTE, avatarForIndex, todayIso, addDaysIso };
