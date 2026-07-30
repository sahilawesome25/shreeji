/* Shreeji Smile Care — staff web app.
   Single-file SPA mirroring the iOS client (same screens, same API). */
(() => {
  'use strict';

  // ── API (same origin — served by the backend) ─────────────────────────

  const api = {
    async request(path, options) {
      const res = await fetch('/api' + path, options);
      let body = null;
      try { body = await res.json(); } catch { /* non-JSON error body */ }
      if (!res.ok) {
        const err = new Error(body?.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return body;
    },
    login: (password) => api.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
    logout: () => api.request('/logout', { method: 'POST' }),
    fetchPatients: () => api.request('/patients'),
    fetchAppointments: () => api.request('/appointments'),
    createPatient: (form) => api.request('/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }),
    createAppointment: (form) => api.request('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }),
    setInvoicePaid: (id, paid) => api.request('/invoices/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid }),
    }),
  };

  // ── Date/time helpers (match the iOS app's UTC-based formatting) ──────

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const TODAY = todayIso();

  function addDaysIso(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parseIso = (iso) => new Date(iso + 'T00:00:00Z');
  const formatDisplayDate = (iso) => { const d = parseIso(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  const dayOfWeekLabel = (iso) => DOWS[parseIso(iso).getUTCDay()];
  const dayNumber = (iso) => parseIso(iso).getUTCDate();

  function displayTime(time) {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ── Icons (inline SVG, stroke-based) ──────────────────────────────────

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    patients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    billing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/></svg>',
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7b8186" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>',
    chevronLeft: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5-7 7 7 7"/></svg>',
  };

  // ── Constants (match iOS Models.swift) ────────────────────────────────

  const TREATMENT_TYPES = [
    'Check-up', 'Scaling & Polishing', 'Root Canal', 'Crown Fitting',
    'Braces Adjustment', 'Extraction', 'Whitening', 'Implant Consult',
  ];
  const DURATIONS = ['15', '30', '45', '60', '90'];
  const PATIENT_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'In Treatment' },
    { id: 'new', label: 'New' },
    { id: 'overdue', label: 'Overdue' },
  ];
  const DETAIL_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'treatment', label: 'Treatment' },
    { id: 'billing', label: 'Billing' },
    { id: 'photos', label: 'Photos' },
    { id: 'rx', label: 'Rx' },
  ];

  // ── State ─────────────────────────────────────────────────────────────

  const state = {
    screen: 'home',          // home | patients | schedule | billing | detail | addPatient | addAppt
    activeTab: 'home',
    patients: [],
    appointments: [],
    loading: true,
    loadError: null,
    selectedPatientId: null,
    detailTab: 'overview',
    patientSearch: '',
    patientFilter: 'all',
    selectedDate: TODAY,
    npForm: null,
    naForm: null,
    formError: '',
    submitting: false,
  };

  const screenEl = document.getElementById('screen');
  const tabbarEl = document.getElementById('tabbar');

  // ── Derived data ──────────────────────────────────────────────────────

  const patientById = (id) => state.patients.find(p => p.id === id);
  const patientName = (id) => patientById(id)?.name ?? 'Unknown';

  const todaysAppointments = () =>
    state.appointments.filter(a => a.date === TODAY).sort((a, b) => a.time.localeCompare(b.time));

  function filteredPatients() {
    const q = state.patientSearch.trim().toLowerCase();
    return state.patients.filter(p => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      switch (state.patientFilter) {
        case 'active': return p.status === 'active';
        case 'new': return p.status === 'new';
        case 'overdue': return p.balance > 0;
        default: return true;
      }
    });
  }

  function badgeFor(p) {
    if (p.balance > 0) return { label: `${rupees(p.balance)} due`, bg: 'var(--badge-overdue-bg)', fg: 'var(--red)' };
    if (p.status === 'new') return { label: 'New', bg: 'var(--badge-new-bg)', fg: 'var(--badge-new-fg)' };
    return { label: 'Active', bg: 'var(--badge-active-bg)', fg: 'var(--green)' };
  }

  const weekDays = () => Array.from({ length: 7 }, (_, i) => addDaysIso(TODAY, i - 3));
  const apptsForSelectedDay = () =>
    state.appointments.filter(a => a.date === state.selectedDate).sort((a, b) => a.time.localeCompare(b.time));

  const billingPatients = () =>
    state.patients.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance);
  const totalOutstanding = () => billingPatients().reduce((s, p) => s + p.balance, 0);

  // ── Rendering ─────────────────────────────────────────────────────────

  function avatarHtml(p, lg = false) {
    return `<div class="avatar${lg ? ' lg' : ''}" style="background:${esc(p.avatarBg)};color:${esc(p.avatarFg)}">${esc(initials(p.name))}</div>`;
  }

  function render() {
    const views = {
      home: renderHome, patients: renderPatients, schedule: renderSchedule,
      billing: renderBilling, detail: renderDetail, addPatient: renderAddPatient, addAppt: renderAddAppt,
      login: renderLogin,
    };
    if (state.loading) {
      screenEl.innerHTML = '<div class="center-fill"><div class="spinner"></div><div>Loading…</div></div>';
    } else if (state.loadError) {
      screenEl.innerHTML = `<div class="center-fill"><div>${esc(state.loadError)}</div><button class="retry-btn" data-action="retry">Retry</button></div>`;
    } else {
      screenEl.innerHTML = views[state.screen]();
    }
    const showTabBar = ['home', 'patients', 'schedule', 'billing'].includes(state.screen);
    tabbarEl.hidden = !showTabBar;
    screenEl.classList.toggle('no-tabbar', !showTabBar);
    if (showTabBar) renderTabbar();
    screenEl.scrollTop = 0;
    window.scrollTo(0, 0);
    if (state.screen === 'login' && !state.submitting) {
      document.getElementById('login-password')?.focus();
    }
  }

  function renderTabbar() {
    const tabs = [
      { id: 'home', label: 'Home', icon: ICONS.home },
      { id: 'patients', label: 'Patients', icon: ICONS.patients },
      { id: 'schedule', label: 'Schedule', icon: ICONS.schedule },
      { id: 'billing', label: 'Billing', icon: ICONS.billing },
    ];
    tabbarEl.innerHTML = tabs.map(t =>
      `<button data-action="tab" data-tab="${t.id}" class="${state.screen === t.id ? 'active' : ''}">${t.icon}<span>${t.label}</span></button>`
    ).join('');
  }

  function renderLogin() {
    return `
      <div class="login-screen">
        <div class="login-logo">
          <svg viewBox="16 9 72 75" fill="none">
            <path d="M50 22c-6-5-14-7-21-3-9 5-12 16-8 27 4 12 7 25 9 33 1 4 6 4 7 0l4-17c2-7 16-7 18 0l4 17c1 4 6 4 7 0 2-8 5-21 9-33 4-11 1-22-8-27-7-4-15-2-21 3z" fill="#ffffff"/>
            <path d="M76 14l2.6 6.8L85 23.4l-6.4 2.6L76 32.8l-2.6-6.8-6.4-2.6 6.4-2.6z" fill="#ca9d33"/>
          </svg>
        </div>
        <div class="login-title">Shreeji Smile Care</div>
        <div class="login-sub">Staff sign in</div>
        ${state.formError ? `<div class="error-banner" style="width:100%">${esc(state.formError)}</div>` : ''}
        <form id="login-form" class="login-form">
          <div class="field">
            <label>Clinic password</label>
            <input id="login-password" type="password" autocomplete="current-password" autofocus />
          </div>
          <button type="submit" class="login-btn" data-action="sign-in" ${state.submitting ? 'disabled' : ''}>
            ${state.submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>`;
  }

  function renderHome() {
    const appts = todaysAppointments();
    const rows = appts.length
      ? `<div class="card-list">${appts.map(a => `
          <button class="card-row" data-action="open-patient" data-id="${esc(a.patientId)}">
            <div class="row" style="gap:0">
              <span class="appt-time">${esc(displayTime(a.time))}</span>
              <span class="appt-divider"></span>
              <span>
                <div class="item-title">${esc(patientName(a.patientId))}</div>
                <div class="item-sub">${esc(a.type)}</div>
              </span>
            </div>
          </button>`).join('')}</div>`
      : '<div class="empty-state">No appointments scheduled today.</div>';

    return `
      <div class="row between top" style="margin-bottom:18px">
        <div>
          <div class="home-greeting">Good morning,</div>
          <div class="home-name">Dr. Ritika Mahajan</div>
        </div>
        <button class="avatar" data-action="sign-out" title="Sign out" style="background:var(--teal);color:#fff;border-radius:14px;font-size:16px">RM</button>
      </div>
      <div class="overline" style="margin-bottom:8px">Shreeji Smile Care Clinic</div>
      <div class="stat-cards">
        <div class="stat-card teal"><div class="stat-num">${appts.length}</div><div class="stat-label">Appointments today</div></div>
        <div class="stat-card gold"><div class="stat-num">${state.patients.length}</div><div class="stat-label">Total patients</div></div>
      </div>
      <div class="quick-actions">
        <button class="quick-action" data-action="add-patient">
          <span class="qa-icon" style="background:var(--qa-teal-icon-bg);color:var(--teal)">+</span>Add Patient
        </button>
        <button class="quick-action" data-action="add-appt">
          <span class="qa-icon" style="background:var(--qa-gold-icon-bg);color:var(--qa-gold-icon-fg)">+</span>New Appointment
        </button>
      </div>
      <div class="row between" style="margin-bottom:10px">
        <span class="section-title">Today's schedule</span>
        <button class="see-all" data-action="tab" data-tab="schedule">See all</button>
      </div>
      ${rows}`;
  }

  function renderPatients() {
    const list = filteredPatients();
    const rows = list.length
      ? `<div class="card-list">${list.map(p => {
          const b = badgeFor(p);
          return `
          <button class="card-row" data-action="open-patient" data-id="${esc(p.id)}">
            <div class="row" style="gap:12px">
              ${avatarHtml(p)}
              <span>
                <div class="item-title">${esc(p.name)}</div>
                <div class="item-sub sm">${esc(p.age)} yrs · ${esc(p.gender)} · Last visit ${esc(p.lastVisit)}</div>
              </span>
            </div>
            <span class="badge" style="background:${b.bg};color:${b.fg}">${esc(b.label)}</span>
          </button>`;
        }).join('')}</div>`
      : '<div class="empty-state">No patients match your search.</div>';

    return `
      <div class="header-row">
        <span class="screen-title">Patients</span>
        <button class="add-btn" data-action="add-patient">+</button>
      </div>
      <div class="search-box">
        ${ICONS.search}
        <input type="search" id="patient-search" placeholder="Search patients..." value="${esc(state.patientSearch)}" autocomplete="off" />
      </div>
      <div class="filter-chips">
        ${PATIENT_FILTERS.map(f =>
          `<button class="chip ${state.patientFilter === f.id ? 'active' : ''}" data-action="filter" data-filter="${f.id}">${f.label}</button>`
        ).join('')}
      </div>
      ${rows}`;
  }

  function renderSchedule() {
    const appts = apptsForSelectedDay();
    const label = state.selectedDate === TODAY
      ? `Today, ${formatDisplayDate(state.selectedDate)}`
      : formatDisplayDate(state.selectedDate);
    const rows = appts.length
      ? `<div class="card-list">${appts.map(a => `
          <button class="card-row" data-action="open-patient" data-id="${esc(a.patientId)}">
            <div class="row" style="gap:0">
              <span class="appt-time" style="width:66px;font-size:13.5px">${esc(displayTime(a.time))}</span>
              <span class="appt-divider"></span>
              <span>
                <div class="item-title">${esc(patientName(a.patientId))}</div>
                <div class="item-sub">${esc(a.type)} · ${a.duration}min</div>
              </span>
            </div>
          </button>`).join('')}</div>`
      : '<div class="empty-state">No appointments this day.</div>';

    return `
      <div class="header-row">
        <span class="screen-title">Appointments</span>
        <button class="add-btn" data-action="add-appt">+</button>
      </div>
      <div class="week-strip">
        ${weekDays().map(iso => {
          const selected = iso === state.selectedDate;
          const hasAppt = state.appointments.some(a => a.date === iso);
          return `<button class="day-cell ${selected ? 'selected' : ''}" data-action="select-date" data-date="${iso}">
            <span class="dow">${dayOfWeekLabel(iso)}</span>
            <span class="dom">${dayNumber(iso)}</span>
            ${hasAppt ? '<span class="dot"></span>' : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="date-label">${esc(label)}</div>
      ${rows}`;
  }

  function renderBilling() {
    const list = billingPatients();
    const rows = list.length
      ? `<div class="card-list">${list.map(p => `
          <button class="card-row" data-action="open-patient" data-id="${esc(p.id)}">
            <div class="row" style="gap:12px">
              ${avatarHtml(p)}
              <span>
                <div class="item-title">${esc(p.name)}</div>
                <div class="item-sub sm">${p.pendingInvoiceCount} pending invoice(s)</div>
              </span>
            </div>
            <span class="amount-due">${rupees(p.balance)}</span>
          </button>`).join('')}</div>`
      : '<div class="empty-state">All accounts settled. 🎉</div>';

    return `
      <div class="header-row"><span class="screen-title">Billing</span></div>
      <div class="balance-card">
        <div class="bal-label">Total outstanding</div>
        <div class="bal-amount">${rupees(totalOutstanding())}</div>
      </div>
      <div class="section-title" style="font-size:14px;margin-bottom:10px">Pending payments</div>
      ${rows}`;
  }

  function renderDetail() {
    const p = patientById(state.selectedPatientId);
    const back = `<button class="back-btn" data-action="back">${ICONS.chevronLeft}Back</button>`;
    if (!p) return `${back}<div class="empty-state">Patient not found.</div>`;

    const tabViews = {
      overview: () => `
        <div class="stack">
          <div class="card">
            <div class="info-card-title">Contact</div>
            <div class="info-card-body">DOB ${esc(p.dob)}\n${esc(p.address)}</div>
          </div>
          <div class="allergy-card">
            <div class="info-card-title">Allergies / Alerts</div>
            <div class="info-card-body">${esc(p.allergies)}</div>
          </div>
          <div class="card">
            <div class="info-card-title">Dental notes</div>
            <div class="info-card-body">${esc(p.medicalNotes)}</div>
          </div>
        </div>`,
      treatment: () => p.treatments.length
        ? `<div class="card-list" style="gap:10px">${p.treatments.map(t => {
            const cls = t.status === 'Completed' ? 'completed' : t.status === 'In Progress' ? 'inprogress' : 'planned';
            return `<div class="card">
              <div class="row between" style="margin-bottom:8px">
                <span class="item-title">${esc(t.name)}</span>
                <span class="status-pill ${cls}">${esc(t.status)}</span>
              </div>
              <div class="item-sub sm">Started ${esc(t.date)}</div>
              <div class="progress-track"><div class="progress-fill ${cls === 'completed' ? 'completed' : ''}" style="width:${Number(t.progress) || 0}%"></div></div>
            </div>`;
          }).join('')}</div>`
        : '<div class="empty-state">No treatments recorded yet.</div>',
      billing: () => `
        <div class="stack">
          <div class="balance-row">
            <span class="bal-label">Balance due</span>
            <span class="bal-amount">${rupees(p.balance)}</span>
          </div>
          ${p.invoices.length
            ? `<div class="card-list">${p.invoices.map(inv => `
                <div class="card-row" style="cursor:default">
                  <span>
                    <div class="item-title" style="font-size:13.5px">${esc(inv.description)}</div>
                    <div class="item-sub sm" style="font-size:11.5px">${esc(inv.date)}</div>
                  </span>
                  <span class="row" style="gap:10px">
                    <span style="font-size:14px;font-weight:700">${rupees(inv.amount)}</span>
                    <button class="pay-btn ${inv.paid ? 'paid' : ''}" data-action="toggle-paid" data-id="${esc(inv.id)}" data-paid="${inv.paid}">
                      ${inv.paid ? 'Paid' : 'Mark Paid'}
                    </button>
                  </span>
                </div>`).join('')}</div>`
            : '<div class="empty-state">No invoices yet.</div>'}
        </div>`,
      photos: () => p.photos.length
        ? `<div class="photo-grid">${p.photos.map(ph => `<div class="photo-tile">${esc(ph.label)}</div>`).join('')}</div>`
        : '<div class="empty-state">No photos uploaded yet.</div>',
      rx: () => p.rx.length
        ? `<div class="card-list">${p.rx.map(r => `
            <div class="card-row" style="cursor:default;display:block">
              <div class="item-title" style="font-size:14px">${esc(r.drug)}</div>
              <div class="item-sub">${esc(r.dosage)} · prescribed ${esc(r.date)}</div>
            </div>`).join('')}</div>`
        : '<div class="empty-state">No prescriptions recorded.</div>',
    };

    return `
      ${back}
      <div class="detail-head">
        ${avatarHtml(p, true)}
        <div>
          <div class="detail-name">${esc(p.name)}</div>
          <div class="detail-sub">${esc(p.age)} yrs · ${esc(p.gender)} · ${esc(p.phone)}</div>
        </div>
      </div>
      <div class="segment">
        ${DETAIL_TABS.map(t =>
          `<button class="${state.detailTab === t.id ? 'active' : ''}" data-action="detail-tab" data-tab="${t.id}">${t.label}</button>`
        ).join('')}
      </div>
      ${tabViews[state.detailTab]()}`;
  }

  function field(label, inner) {
    return `<div class="field"><label>${label}</label>${inner}</div>`;
  }
  function selectField(label, name, value, options) {
    return field(label, `<select name="${name}">${options.map(o =>
      `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`
    ).join('')}</select>`);
  }

  function renderAddPatient() {
    const f = state.npForm;
    return `
      <div class="form-header">
        <button class="cancel" data-action="cancel-form">Cancel</button>
        <span class="form-title">New Patient</span>
        <button class="save" data-action="save-patient" ${state.submitting ? 'disabled' : ''}>Save</button>
      </div>
      ${state.formError ? `<div class="error-banner">${esc(state.formError)}</div>` : ''}
      <form class="form-stack" id="np-form">
        ${field('Full name', `<input name="name" value="${esc(f.name)}" placeholder="e.g. Aarav Shah" />`)}
        <div class="form-cols">
          ${field('Age', `<input name="age" value="${esc(f.age)}" inputmode="numeric" />`)}
          ${selectField('Gender', 'gender', f.gender, ['Female', 'Male', 'Other'].map(g => ({ value: g, label: g })))}
        </div>
        ${field('Phone', `<input name="phone" value="${esc(f.phone)}" placeholder="+91 98xxxxxxx" inputmode="tel" />`)}
        ${field('Date of birth', `<input name="dob" type="date" value="${esc(f.dob)}" />`)}
        ${field('Address', `<input name="address" value="${esc(f.address)}" />`)}
        ${field('Allergies / medical alerts', `<input name="allergies" value="${esc(f.allergies)}" placeholder="None known" />`)}
        ${field('Dental notes', `<textarea name="medicalNotes">${esc(f.medicalNotes)}</textarea>`)}
      </form>`;
  }

  function renderAddAppt() {
    const f = state.naForm;
    return `
      <div class="form-header">
        <button class="cancel" data-action="cancel-form">Cancel</button>
        <span class="form-title">New Appointment</span>
        <button class="save" data-action="save-appt" ${state.submitting ? 'disabled' : ''}>Save</button>
      </div>
      ${state.formError ? `<div class="error-banner">${esc(state.formError)}</div>` : ''}
      <form class="form-stack" id="na-form">
        ${selectField('Patient', 'patientId', f.patientId, [
          { value: '', label: 'Select patient…' },
          ...state.patients.map(p => ({ value: p.id, label: p.name })),
        ])}
        <div class="form-cols">
          ${field('Date', `<input name="date" type="date" value="${esc(f.date)}" />`)}
          ${field('Time', `<input name="time" type="time" value="${esc(f.time)}" />`)}
        </div>
        ${selectField('Treatment type', 'type', f.type, TREATMENT_TYPES.map(t => ({ value: t, label: t })))}
        ${selectField('Duration (min)', 'duration', f.duration, DURATIONS.map(d => ({ value: d, label: d })))}
        ${field('Notes', `<textarea name="notes">${esc(f.notes)}</textarea>`)}
      </form>`;
  }

  // ── Form state capture ────────────────────────────────────────────────

  function captureForm() {
    const form = document.getElementById(state.screen === 'addPatient' ? 'np-form' : 'na-form');
    if (!form) return;
    const target = state.screen === 'addPatient' ? state.npForm : state.naForm;
    for (const el of form.elements) {
      if (el.name && el.name in target) target[el.name] = el.value;
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────

  async function loadAll() {
    state.loading = true;
    state.loadError = null;
    render();
    try {
      const [patients, appointments] = await Promise.all([api.fetchPatients(), api.fetchAppointments()]);
      state.patients = patients;
      state.appointments = appointments;
      if (state.screen === 'login') { state.screen = 'home'; state.activeTab = 'home'; }
    } catch (e) {
      if (e.status === 401) {
        state.formError = '';
        state.screen = 'login';
      } else {
        state.loadError = 'Couldn’t reach the server. Is the backend running?';
      }
    }
    state.loading = false;
    render();
  }

  const actions = {
    retry: () => loadAll(),
    'sign-in': async () => {
      const input = document.getElementById('login-password');
      const password = input ? input.value : '';
      state.submitting = true;
      state.formError = '';
      render();
      try {
        await api.login(password);
        state.submitting = false;
        await loadAll();
        return;
      } catch (e) {
        state.formError = e.message || 'Couldn’t sign in.';
      }
      state.submitting = false;
      render();
    },
    'sign-out': async () => {
      if (!window.confirm('Sign out of Shreeji Smile Care?')) return;
      try { await api.logout(); } catch { /* cookie may already be gone */ }
      state.patients = [];
      state.appointments = [];
      state.formError = '';
      state.screen = 'login';
      render();
    },
    tab(el) {
      state.screen = el.dataset.tab;
      state.activeTab = el.dataset.tab;
      render();
    },
    'open-patient': (el) => {
      state.selectedPatientId = el.dataset.id;
      state.detailTab = 'overview';
      state.screen = 'detail';
      render();
    },
    back() {
      state.screen = state.activeTab;
      render();
    },
    'detail-tab': (el) => { state.detailTab = el.dataset.tab; render(); },
    filter(el) { state.patientFilter = el.dataset.filter; render(); },
    'select-date': (el) => { state.selectedDate = el.dataset.date; render(); },
    'add-patient': () => {
      state.formError = '';
      state.npForm = { name: '', age: '', gender: 'Female', phone: '', dob: '', address: '', allergies: '', medicalNotes: '' };
      state.screen = 'addPatient';
      render();
    },
    'add-appt': () => {
      state.formError = '';
      state.naForm = { patientId: '', date: state.selectedDate, time: '10:00', type: 'Check-up', duration: '30', notes: '' };
      state.screen = 'addAppt';
      render();
    },
    'cancel-form': () => { state.screen = state.activeTab; render(); },
    'save-patient': async () => {
      captureForm();
      if (!state.npForm.name.trim()) {
        state.formError = 'Please enter the patient’s name.';
        render();
        return;
      }
      state.submitting = true;
      render();
      try {
        const created = await api.createPatient(state.npForm);
        state.patients.push(created);
        state.selectedPatientId = created.id;
        state.detailTab = 'overview';
        state.activeTab = 'patients';
        state.screen = 'detail';
      } catch (e) {
        state.formError = e.message || 'Couldn’t save patient.';
      }
      state.submitting = false;
      render();
    },
    'save-appt': async () => {
      captureForm();
      if (!state.naForm.patientId) {
        state.formError = 'Please select a patient.';
        render();
        return;
      }
      state.submitting = true;
      render();
      try {
        const created = await api.createAppointment(state.naForm);
        state.appointments.push(created);
        state.selectedDate = created.date;
        state.activeTab = 'schedule';
        state.screen = 'schedule';
      } catch (e) {
        state.formError = e.message || 'Couldn’t save appointment.';
      }
      state.submitting = false;
      render();
    },
    'toggle-paid': async (el) => {
      const wasPaid = el.dataset.paid === 'true';
      try {
        const updated = await api.setInvoicePaid(el.dataset.id, !wasPaid);
        const p = patientById(state.selectedPatientId);
        if (!p) return;
        const idx = p.invoices.findIndex(i => i.id === updated.id);
        if (idx >= 0) p.invoices[idx] = updated;
        p.balance = p.invoices.filter(i => !i.paid).reduce((s, i) => s + i.amount, 0);
        p.pendingInvoiceCount = p.invoices.filter(i => !i.paid).length;
        render();
      } catch {
        // Non-fatal: leave state as-is; user can retry the tap.
      }
    },
  };

  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    actions[el.dataset.action]?.(el);
  });

  document.body.addEventListener('submit', (e) => {
    if (e.target.id === 'login-form') {
      e.preventDefault();
      actions['sign-in']();
    }
  });

  document.body.addEventListener('input', (e) => {
    if (e.target.id === 'patient-search') {
      state.patientSearch = e.target.value;
      // Re-render the list only, keeping focus in the search input.
      const chips = document.querySelector('.filter-chips');
      let next = chips.nextElementSibling;
      while (next) { const n = next.nextElementSibling; next.remove(); next = n; }
      const list = filteredPatients();
      chips.insertAdjacentHTML('afterend', list.length
        ? `<div class="card-list">${list.map(p => {
            const b = badgeFor(p);
            return `<button class="card-row" data-action="open-patient" data-id="${esc(p.id)}">
              <div class="row" style="gap:12px">${avatarHtml(p)}
                <span><div class="item-title">${esc(p.name)}</div>
                <div class="item-sub sm">${esc(p.age)} yrs · ${esc(p.gender)} · Last visit ${esc(p.lastVisit)}</div></span>
              </div>
              <span class="badge" style="background:${b.bg};color:${b.fg}">${esc(b.label)}</span>
            </button>`;
          }).join('')}</div>`
        : '<div class="empty-state">No patients match your search.</div>');
    }
  });

  // ── Service worker (PWA install + offline shell) ──────────────────────

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* non-fatal */ });
  }

  loadAll();
})();
