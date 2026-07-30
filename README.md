# Shreeji Smile Care

A staff-only patient tracker for Shreeji Smile Care Clinic (Dr. Ritika Mahajan),
implemented from a [Claude Design](https://claude.ai/design) prototype
(see `chats/` and `project/` for the original handoff bundle).

- **`backend/`** — Node.js + Express + MySQL REST API. Owns all patient,
  appointment, treatment, invoice, and prescription data. Also serves the web
  app below.
- **`web/`** — Progressive web app (staff client). Installable to a phone's
  home screen straight from the browser — no App Store, no Xcode, no signing.
  This is the recommended way to use the app on a phone.
- **`ios/ShreejiSmileCare/`** — Native SwiftUI iOS app (staff client). Talks to
  the backend over HTTP. Requires a Mac with Xcode to install.

The web app is protected by a single shared staff password (no per-user
accounts — the clinic's staff is small and trusted). Set it with the
`CLINIC_PASSWORD` environment variable; without it the server falls back to
the dev password `shreeji123` and logs a warning. **Always set a strong
`CLINIC_PASSWORD` before exposing the server to the internet.**

## Running the web app

Requires Node.js 18+ and a MySQL (or MariaDB) database. For local development,
create one that matches the dev defaults:

```sql
CREATE DATABASE shreeji;
CREATE USER 'shreeji'@'localhost' IDENTIFIED BY 'shreeji_dev';
GRANT ALL PRIVILEGES ON shreeji.* TO 'shreeji'@'localhost';
```

Then:

```bash
cd backend
npm install
npm start
```

The server creates the tables and seeds demo data on first run. To point at a
different database, set `DATABASE_URL` (`mysql://user:pass@host:3306/dbname`)
or the individual `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` /
`MYSQL_PASSWORD` / `MYSQL_DATABASE` variables.

Then open `http://localhost:4000` in a browser — the backend serves the web
app and the API from the same origin, so there is nothing to configure. Sign
in with the clinic password (`CLINIC_PASSWORD` env var, or `shreeji123` in
dev). Sessions last 30 days; tap the avatar on the Home screen to sign out.
Changing `CLINIC_PASSWORD` signs every device out immediately.

**Installing on a phone (PWA):**

1. Make the backend reachable from the phone: run it on a machine on the same
   Wi-Fi network and browse to `http://<machine-ip>:4000` from the phone, or
   host it on a small cloud server (see Caveats).
2. iPhone (Safari): tap **Share → Add to Home Screen**. Android (Chrome): tap
   the **Install app** prompt or **⋮ → Add to Home screen**.
3. The app opens full-screen with its own icon, like a native app. No expiry,
   no developer account, and updates apply automatically on the next launch.

## Deploying on Hostinger (Business / Cloud plan)

Hostinger's managed Node.js web app hosting runs this repo directly. The app's
own file storage there is ephemeral — which is exactly why the data lives in
MySQL, not on disk.

1. **Create the database**: hPanel → **Databases → MySQL Databases** → create
   a database and user, note the credentials and host.
2. **Add the app**: hPanel → **Websites → Add website → Web app (Node.js)** →
   connect the GitHub repository. The root `package.json` makes the defaults
   work: install runs `npm install` (which also installs `backend/`), start
   command is `npm start`.
3. **Set environment variables** during setup:
   - `DATABASE_URL` = `mysql://DBUSER:DBPASS@DBHOST:3306/DBNAME` (from step 1)
   - `CLINIC_PASSWORD` = a strong password of your choosing
4. **Attach the domain**: choose a subdomain of your existing domain (e.g.
   `clinic.yourdomain.com`). Hostinger adds the DNS record and provisions
   HTTPS automatically; your existing sites are untouched.

First start creates the tables and seeds demo data automatically. Staff can
then open the URL on their phones, sign in, and Add to Home Screen.

## Running the backend

See **Running the web app** above — the same `npm start` serves both the API
and the web app on port 4000 (override with `PORT`). The demo seed runs only
when the `patients` table is empty; to reset to seed data, drop the tables
(or the whole database) and restart.

Key endpoints:

| Method | Path                  | Notes                                  |
|--------|-----------------------|-----------------------------------------|
| POST   | `/api/login`          | `{ "password": "…" }` → sets the session cookie (rate-limited) |
| POST   | `/api/logout`         | Clears the session cookie              |
| GET    | `/api/session`        | `{ "authenticated": true/false }`      |
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

Both clients (web and iOS) match the approved prototype
(`project/Shreeji Smile Care.dc.html` + `chats/chat1.md`) screen-for-screen:

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
- **Auth is a single shared password.** Good enough for a small trusted
  staff, but there are no per-user accounts or audit trail. All `/api`
  routes except `login`/`logout`/`session`/`health` require the session
  cookie.
- **The iOS app has no login screen yet.** It will get 401s from a backend
  running this version — use the web app on phones, or add cookie handling
  to `APIClient.swift` if the native app is still wanted.
- **Photos tab is a placeholder.** The prototype never had real image
  upload/storage either — it showed labeled placeholder tiles. Wiring up
  actual photo capture/storage (e.g. camera roll + file storage or S3) is a
  follow-up.
- **Take database backups.** The MySQL database is the only copy of the
  clinic's data. On Hostinger, enable automatic backups (or export the
  database from hPanel periodically).
