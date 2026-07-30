# Shreeji Smile Care

A staff-only patient tracker for Shreeji Smile Care Clinic (Dr. Ritika Mahajan),
implemented from a [Claude Design](https://claude.ai/design) prototype
(see `chats/` and `project/` for the original handoff bundle).

- **`backend/`** — Node.js + Express + SQLite REST API. Owns all patient,
  appointment, treatment, invoice, and prescription data.
- **`ios/ShreejiSmileCare/`** — Native SwiftUI iOS app (staff client). Talks to
  the backend over HTTP.

There's no login yet — the app assumes a single shared clinic device, matching
what was agreed when this was scoped.

## Running the backend

Requires Node.js 18+.

```bash
cd backend
npm install
npm start
```

This starts the API on `http://localhost:4000` and creates `backend/data/clinic.sqlite3`
on first run, seeded with the same demo patients/appointments used in the
original prototype. Delete `backend/data/` to reset to the seed data.

Key endpoints:

| Method | Path                  | Notes                                  |
|--------|-----------------------|-----------------------------------------|
| GET    | `/api/patients`       | All patients, with treatments/invoices/rx/photos and computed balance |
| GET    | `/api/patients/:id`   | One patient, full detail               |
| POST   | `/api/patients`       | Create a patient (`name` required)     |
| GET    | `/api/appointments`   | All appointments (optional `?date=YYYY-MM-DD`) |
| POST   | `/api/appointments`   | Create an appointment (`patientId` required) |
| PATCH  | `/api/invoices/:id`   | `{ "paid": true/false }`               |

## Running the iOS app

Requires a Mac with Xcode 15+ (this was built and cannot be compiled or run
in the Linux environment that generated it — see **Caveats** below).

1. Start the backend first (see above) — the app fetches data on launch and
   has nothing to show without it.
2. Open `ios/ShreejiSmileCare/ShreejiSmileCare.xcodeproj` in Xcode.
3. Select your own team under the target's *Signing & Capabilities* tab
   (the project uses automatic signing but has no team configured).
4. Run on the iOS Simulator (`⌘R`). The Simulator shares the Mac's network,
   so `http://localhost:4000` in `APIClient.swift` works out of the box.

**Testing on a physical device:** the Simulator's `localhost` won't resolve
to your Mac from a real iPhone. Change `baseURL` in
`ios/ShreejiSmileCare/ShreejiSmileCare/APIClient.swift` to your Mac's LAN IP
(e.g. `http://192.168.1.23:4000`), and make sure the phone is on the same
Wi-Fi network as the Mac running the backend.

## What's implemented

Matches the approved prototype (`project/Shreeji Smile Care.dc.html` +
`chats/chat1.md`) screen-for-screen:

- **Home** — greeting, today's appointment count / total patients, quick
  actions, today's schedule.
- **Patients** — search, filter chips (All / In Treatment / New / Overdue),
  patient list with status badges.
- **Patient Detail** — Overview, Treatment (progress bars), Billing
  (mark-paid), Photos (placeholder grid — no real image upload/storage yet),
  Rx tabs.
- **Appointments** — 7-day day-strip calendar, appointments for the selected day.
- **Billing** — total outstanding, pending payments by patient.
- **Add Patient / Add Appointment** — forms with the same fields and
  validation as the prototype.

Colors were converted 1:1 from the prototype's `oklch()` values to sRGB hex
(see `AppTheme.swift`).

## Caveats

- **The SwiftUI code has not been compiled.** This was built in a Linux
  container with no Xcode/Swift-for-iOS toolchain available, so while the
  code was written and reviewed carefully (including a pass to avoid known
  Swift type-inference pitfalls), it hasn't been verified by an actual build.
  Please open it in Xcode and fix any small issues that surface — flag them
  back if you'd like help.
- **No authentication.** Scoped out for this pass; the API has no auth and
  the app has no login screen.
- **Photos tab is a placeholder.** The prototype never had real image
  upload/storage either — it showed labeled placeholder tiles. Wiring up
  actual photo capture/storage (e.g. camera roll + file storage or S3) is a
  follow-up.
- **Backend has no deployment story.** It's meant to run locally (or on a
  machine on the clinic's LAN) for now — no HTTPS, no process manager,
  no production database.
