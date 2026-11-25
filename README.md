# Buildesk Compass

Internal operations platform for **Buildesk** — track real-estate **ERP** clients and **Sales CRM** accounts from signup through module adoption, onboarding, go-live, support, training, payments, renewals, and reporting.

The app ships as **two products in one codebase**. Each user has a `productScope` (`erp` or `crm`) that controls their home route, sidebar, and search scope.

| Product | Home | Audience |
| --- | --- | --- |
| **ERP Onboarding Tracker** | `/` | ERP implementation — companies, projects, post-sales, DPR, meetings |
| **Sales CRM** | `/crm` | CRM onboarding — accounts, payments, Sales CRM modules, meetings, tasks |

Both products share authentication, SQLite storage, automation hooks, client portals, ticket tracking, live chat, and the design-ticket UI kit.

---

## Table of contents

- [Overview](#overview)
- [Sales CRM](#sales-crm)
- [ERP Onboarding Tracker](#erp-onboarding-tracker)
- [Client portal](#client-portal)
- [Shared capabilities](#shared-capabilities)
- [Integrations](#integrations)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Scripts](#scripts)
- [Android app](#android-app)
- [Environment](#environment)
- [Deployment](#deployment)
- [Project layout](#project-layout)
- [Typical flows](#typical-flows)
- [License](#license)

---

## Overview

Buildesk Compass replaces scattered sheets and chat with structured lifecycle tracking:

1. **Account / company** is created with plan, managers, commercial terms, and module opt-ins
2. **Onboarding** runs through checklists — masters, migration, training, reports, integrations
3. **Go-live** gates production readiness (stage-driven; CRM go-live marks the account Live and syncs progress)
4. **Post go-live** — support tickets, tasks, meetings, payments, queries, training, renewals, and reports

Seed data includes ERP companies/projects and CRM accounts so local development feels like production.

---

## Sales CRM

Route prefix: **`/crm`**. Navigation is defined in `src/lib/crm-nav.ts`.

### CRM navigation

| Module | Route | Purpose |
| --- | --- | --- |
| **Dashboard** | `/crm` | Portfolio KPIs, pending tasks and queries, module adoption, health, recent work, drill-down lists |
| **Accounts** | `/crm/accounts` | Customer accounts — filters, bulk upload/export, date bulk update, API-key bulk, client transfer, commercial fields |
| **Usage** | `/crm/usage` | Daily CRM usage for Onboarding, Live, and Active accounts; saved days, nightly refresh, fill-missing-days |
| **Payments** | `/crm/payments` | Collection board — installments, ledger, renewals, reminders, executive overdue digest |
| **Meetings** | `/crm/bookings` | Portal booking requests, executive availability, Google Calendar + Meet, end-early |
| **Tasks** | `/crm/tasks` | Follow-up tasks — list and calendar, assignees, reminders (including Reminder type) |
| **Account queries** | `/crm/queries` | Internal discussions — threads, attachments, mentions |
| **Broadcast** | `/crm/broadcasts` | WhatsApp broadcasts to account groups — send now or schedule |
| **Win-back** | `/crm/win-back` | Outreach for accounts that need a win-back conversation |
| **Activity history** | `/crm/activity` | Unified feed — visits, tasks, bookings, tickets, tracker, modules, queries |
| **Support Desk** | `/crm/support` | Internal `TKT-*` engineering tickets |
| **Ticket Tracking** | `/crm/tickets` | Client `DT-*` portal tickets, Support 1 assignment, pending-by-executive chart |
| **Live Chat** | `/crm/live-chat` | Portal chat inbox |
| **Automation** | `/crm/automation` | CRM rules — bookings, tasks, payments, queries, SLA, n8n / WAHA (admin) |
| **Master** | `/crm/master` | Fields, picklists, modules, checklists, call types, booking defaults, data control (admin) |
| **Settings** | `/crm/settings` | Users, branding, alerts, onboarding SLA targets, Google Calendar, web push, profile |

### Account workspace

Each CRM account opens a hub at `/crm/accounts/$accountId` with tabs:

| Tab | Purpose |
| --- | --- |
| **Dashboard** | Health, progress, module cards, commercial snapshot, portal link |
| **Modules** | Opted product modules with progress; drill into Sales CRM sections |
| **Go-Live** | Verification checklist (integration-gated items); stage drives Live vs Onboarding |
| **Tasks** | Account-scoped follow-up tasks |
| **Meetings** | Bookings linked to the account |
| **Tickets** | Portal / support tickets for the account |
| **Queries** | Threaded internal queries with attachments & mentions |
| **Comms** | Communication log |
| **WhatsApp** | Linked group for kickoff and broadcast messages, where configured |

### Opt-in product modules

**Core**

- Sales CRM, CP Application, Reception Application, Sim Based Calling, AI Call Analysis, WAHA, Auto Dialer

**Integrations**

- WhatsApp, SMS, Email, IVR, Meta Lead, Google Ads, Website, 99acres, MagicBricks, Housing

**Sales CRM module** (`/crm/accounts/$accountId/modules/sales-crm`) includes:

- **Integrations** — channel integrations with provider pickers (opt-in gated)
- **Masters** — master data checklist with status filters (Pending / Completed / N/A)
- **Migration** — data migration checklist
- **Training** — training sessions with multi-session history
- **Reports** — client report explanation checklist

Overall account progress: each **non–Sales CRM core module** contributes **10%**; **Sales CRM holds the remainder** (e.g. 90% with one other module). Integrations roll into Sales CRM progress, not overall weights. **CP Application** uses a gated step workflow with uploads and dates.

### CRM account creation

The account form includes:

- Commercial terms (deal size, installments, users purchased, value per user excl. GST)
- Sales manager, Support manager 1 & 2
- **Location** — Country → State → City via [Country State City API](https://countrystatecity.in) (server-proxied; requires `CSC_API_KEY`)
- Auto **Buildesk region** (NCR / South / West / Rest of India) from Indian states
- Optional portal API key (URL slug) and module picker on create
- Bulk sheet import/export and API-key bulk upload

### Payments (`/crm/payments`)

Collection board for deal value vs received amounts:

| Capability | Details |
| --- | --- |
| **Filters / tabs** | Overdue, due this week / month, due in 45 / 90 days, upcoming, fully paid, **renewal**, not started, lost |
| **Installment allocation** | Payments fill installments chronologically; status paid / partial / overdue |
| **Renewal** | Amounts **beyond deal value** are classified as renewal (separate from fully paid) |
| **Ledger CRUD** | Record, **update**, and **delete** payment transactions (with optional receipt image) |
| **Remarks** | Collection remarks with optional images |
| **Reminders** | Client payment reminder + executive reminder; bulk executive digest |
| **Bulk sheet** | Import paid amounts from spreadsheet |

### Meetings / bookings (`/crm/bookings`)

Cal.com-style booking for CRM accounts:

| Capability | Details |
| --- | --- |
| **Request lifecycle** | Pending → Approve / Decline; Confirmed / Postponed / Cancelled / Completed |
| **Create meeting** | Staff can create confirmed bookings from CRM |
| **Availability** | Executive weekly hours + date blocks that hide portal slots |
| **Google Calendar** | Approve creates Calendar event + Meet link; FreeBusy hides busy slots |
| **End meeting** | After start, **End meeting** completes early, shortens the slot, updates Google, and frees the executive for another booking |
| **Portal** | Guests book open slots; status visible on portal dashboard |

### Tasks (`/crm/tasks`)

- List + day / week / month calendar views
- Filters: my tasks, open, overdue, due today
- Assignees, priorities, schedule conflict checks
- **Reminder** task type — in-app + web push only; does **not** block calendar availability
- Auto status: open → in progress → **overdue** after end time
- Task tiles show **Company – Task title**; unscheduled sort by created time

### CRM dashboard highlights

- Open / overdue / due-today **tasks**, open **queries**, go-live pending counts
- Drill-down to filtered account lists
- **Modules opted** chart (core modules only — integrations excluded)
- Recent open tasks (with assignees) and queries
- Session-persisted filters across list pages

### Usage (`/crm/usage`)

- Board for Onboarding, Live, and Active accounts
- Windows for recent days; cards for leads-only, missing days, suspended, and not connected
- Saved daily reports open immediately
- Nightly job (12:10am IST) refetches yesterday and replaces the stored day
- **Fill missing days** backfills gaps
- Lead receipt alone is not treated as CRM use
- Account detail at `/crm/usage/$accountId`

### Broadcast (`/crm/broadcasts`)

- Compose a WhatsApp message for selected account groups
- Send immediately or schedule
- Optional media attachment
- Uses the CRM WAHA session

### Win-back (`/crm/win-back`)

WhatsApp outreach to former clients, separate from live CRM accounts:

- Import contacts from CSV (`CompanyName`, `ContactPerson`, `Mobile`)
- Contacts, campaigns, templates, and delivery activity
- Campaigns send in waves; pause, resume, retry, and cancel
- Compose a message (and optional media) for the selected contacts

### Ticket Tracking (`/crm/tickets`)

- KPI cards: all, awaiting pickup, being worked, resolved + closed, active at least 7 days
- Pending chart grouped by the account’s Support 1
- Filters for status, priority, category, account, Support 1 / 2, and sales
- **Assign to Support 1** assigns every unassigned open or in-progress ticket to the account’s Support 1 user
- Preview sheet, full ticket thread, and portal-link admin at `/crm/tickets/links`

### CRM automation rules

Stored in SQLite (`app_config` key `crm-automation`) so toggles survive deploy. Seed triggers include:

- Ticket created, updated, closed, and team reply
- Portal ticket created
- Booking created and booking status changed
- Task reminder before start
- Payment overdue and executive payment digest
- Account renewal reminder
- Query response
- Live chat started
- Onboarding SLA behind target (WhatsApp to Support 1, Support 2, and admins)

### CRM settings and master

- **Settings** — org profile, users and roles, notification devices, Google Calendar connection, onboarding SLA day-buckets, backups
- **Master** — custom account fields, picklists, product modules, migration / training / report checklists, and a reset for the CRM catalog

---

## ERP Onboarding Tracker

Route prefix: **`/`** (default for `productScope: erp`). Navigation in `src/lib/nav.ts`.

### ERP navigation

Primary sidebar:

| Module | Route | Purpose |
| --- | --- | --- |
| **Dashboard** | `/` | Command center — status, checklist, adoption, health, closest accounts, act-next queue |
| **Companies** | `/companies` | Company list, create/edit, bulk assign manager, company hub |
| **Payments** | `/payments` | ERP company collection board (separate from CRM payments) |
| **Support Desk** | `/support` | Internal `TKT-*` tickets |
| **Ticket Tracking** | `/tickets` | Client `DT-*` tickets; portal links at `/tickets/links` |
| **Live Chat** | `/live-chat` | Portal chat inbox (`manageTickets`) |
| **Tasks** | `/tasks` | ERP follow-up tasks (`manageTasks`) |
| **My DPR** | `/dpr` | Daily progress report (`manageDpr`) |
| **Meetings** | `/meetings` | ERP meetings (`manageErpMeetings`) |
| **Reports** | `/reports` | Operational reports (`viewReports`) |
| **Settings** | `/settings` | Org, users, permissions, and the operations catalog |

Reached from Settings, not the main sidebar:

| Module | Route | Purpose |
| --- | --- | --- |
| **Onboarding Tracker** | `/onboarding` | Cross-company checklist pipeline |
| **Modules & Add-ons** | `/modules` | Post Sales, Vendor, Labor, Customer App, Construction, Project Management, and the rest of the catalog |
| **Data Migration** | `/data-migration` | Migration checklists and uploads |
| **Document Templates** | `/documents` | Required-document tracking |
| **Customer App** | `/customer-app` | Customer-app rollout |
| **Vendor Management** | `/vendors` | Vendor board |
| **Labor Management** | `/labor` | Labor board |
| **Integrations & Triggers** | `/integrations` | Integration setup |
| **Training** | `/training` | Training sessions |
| **DPR Tracker** | `/dpr/tracker` | Executive DPR compliance (`viewDprTracker`) |
| **Client Visits** | `/client-visits` | Field visits (`manageClientVisits`) |
| **Renewals** | `/renewals` | Plan expiry and billing lifecycle |
| **Employees** | `/employees` | Staff directory (`manageEmployees`) |
| **Master Config** | `/master` | Platform catalogs (admin) |
| **Automation** | `/automation` | n8n email and WAHA WhatsApp (admin) |

### Company → project lifecycle

```
Company
  ├── Modules & add-ons
  ├── Projects
  │     ├── Progress tracker
  │     ├── Onboarding checklist
  │     ├── Data migration
  │     ├── Documents → checklist items
  │     ├── Vendors / Labor / Integrations / Training
  │     ├── Tickets (project-scoped)
  │     └── Go Live
  ├── Notes & files
  ├── Meetings / visits / tasks
  └── Billing / renewals context
```

### ERP dashboard (`/`)

- **Date range** — Last 7 / 30 / 90 days or all time. A company is included when its start date (else agreement date, else created date) falls in the range. Cards, onboarding mix, modules, health, pipeline, recent companies, and activity follow that range. Pending overview stays the live open queue.
- **Company cards** — Total, in progress, completed, on hold. The percentage is that count divided by the companies in the selected range (the total card’s percentage is the range divided by every company). Hover the percentage for the counts.
- **Onboarding mix** — Chart menu switches the donut between status, plan, region, and health. A slice opens those companies.
- **Modules opted** — The companies menu recounts opt-ins for all, in progress, completed, or on hold, and can show the top 6 modules or every module. A bar opens the companies that opted in.
- **Pipeline completion** — Completed checklist steps divided by every collect, upload, and go-live step for companies in the range.
- **Pending overview** — Current overdue follow-ups, tickets, checklist bottlenecks, visits, and renewals. Those chips are not filtered by the date range.
- Counts and chart slices open the drill-down sheet. **+ New Onboarding** goes to `/companies`.

### ERP payments (`/payments`)

- Company-level commercial collection, not the CRM installment board
- Sort by pending, overdue, next due, collected percent, or name
- Bulk update payments from a sheet
- Empty and error states stay on this page; company commercial fields are edited on the company Details tab

### Company hub tabs

Details · Modules · Tickets · Tasks · Meetings · Visits · Notes & Files · History · Payments · Billing · WhatsApp

WhatsApp stores the implementation group used by company-created automation. Payments on the hub is the company’s own ledger, linked to `/payments`.

### Companies list

- Search, filters, create and edit (POC, owner, Support 1 / 2, sales agent, modules, commercial plan)
- Bulk assign onboarding manager
- Delete with confirmation
- Sheet import/export where enabled

### Support Desk and Ticket Tracking

- **Support Desk** (`/support`, `/support/$ticketId`) — internal engineering tickets, status pipeline, updates, edit and delete
- **Ticket Tracking** (`/tickets`, `/tickets/$ticketId`) — client portal tickets; bulk assign, status, and priority; company portal links at `/tickets/links`

### Tasks, visits, meetings, DPR

- **Tasks** — ERP follow-ups tied to companies
- **Client visits** (`/client-visits`) — field visits and follow-up dates (`manageClientVisits`)
- **Meetings** — types (kickoff, training, review, demo, check-in, and others), formats (online, in person, phone), statuses (scheduled, completed, cancelled, postponed, no-show), list and calendar, optional Google Calendar for online meetings
- **My DPR** — daily log with templates, categories, priorities, and day submit
- **DPR Tracker** (`/dpr/tracker`) — manager compliance view across executives (`viewDprTracker`)

### Operations catalog (from Settings)

- **Onboarding tracker** — all companies’ checklist position
- **Modules & add-ons** — Post Sales, Vendor, Labor, Customer App, Construction, Project Management, and the rest of the ERP catalog
- **Data migration** — migration checklists and uploads
- **Document templates** — required documents per implementation
- **Customer app** — rollout tracking
- **Vendors** and **Labor** — operational boards, including drag-and-drop where the board uses it
- **Integrations & triggers** — integration setup
- **Training** — training sessions
- **Renewals** — plan expiry / billing lifecycle
- **Employees** — staff directory (`manageEmployees`)
- **Master Config** (`/master`, admin) — platform catalogs
- **Automation** (`/automation`, admin) — n8n email and WAHA WhatsApp

### ERP automation

Rules persist in SQLite (`app_config` key `automation`). The enable-automation toggle, webhook base, and WAHA session name are saved from the Automation page (admin). Seed rules:

- Ticket created and ticket closed — email and WhatsApp
- **Company created** — implementation email to the POC (owner CC when different) and WhatsApp to the company group
- Attachments (Excel, PDF, Word, images, `.zip`, `.rar`) go out as multipart files (`email_file`) on email and as WAHA media on WhatsApp
- Kickoff signatures use `{{managerName}}`, `{{managerPhone}}`, and `{{managerEmail}}` from the company’s Support 1 (then onboarding manager, then CSM)

### Reports (`/reports`)

Chart plus detail table and download. Report set includes commercial, vendor, labor, people, churn, integrations, defects, time, and work-mix views driven by ERP data already in the app.

### Projects

`/projects` lists implementation projects. `/projects/$projectId` is the project workspace: onboarding checklist, progress, migration, documents, vendors, labor, integrations, training, tickets, and go-live. Post-sales module projects open at `/companies/$companyId/modules/post-sales/projects/$projectId`.

### Daily Progress Reports (DPR)

| View | Route | Audience |
| --- | --- | --- |
| **My DPR** | `/dpr` | Executives log daily work — templates, categories, priorities, day submit |
| **DPR Tracker** | `/dpr/tracker` | Managers filter/search compliance across executives |

---

## Client portal

Per-company or per-CRM-account portal at **`/portal/{slug}`**:

| Page | Purpose |
| --- | --- |
| Dashboard | KPI cards, recent tickets, booking status |
| Create ticket | Self-service request with attachments |
| My Tickets / Solved | Active and closed ticket lists and ticket thread |
| Book a call | Slot booking against executive availability (CRM) |
| Academy | Tutorials list and tutorial detail |
| Profile | Contact details |

- **Buildesk Assistant** chatbot with knowledge base and escalation to live agents
- Booking status on portal dashboard (pending / confirmed / declined / postponed / completed)
- Portal base URL via `VITE_PORTAL_BASE_URL`
- Embeddable in iframes via `PORTAL_FRAME_ANCESTORS` (default `*` when unset)

### Two ticket systems

| | **Ticket Tracking** (`DT-*`) | **Support Desk** (`TKT-*`) |
| --- | --- | --- |
| **Raised by** | Clients via portal | Internal team |
| **Scope** | Company / account design & support | Engineering pipeline |
| **ERP routes** | `/tickets` | `/support` |
| **CRM routes** | `/crm/tickets` | `/crm/support` |

---

## Command Center (`/admin`)

Admin accounts open this from the profile menu. It is a separate shell from the ERP and CRM sidebars.

It reads the same SQLite database. Logins, logouts, page visits, and heartbeats are stored from the moment this release is running. Older history is not backfilled. Counts for companies, CRM accounts, tasks, payments, and tickets come from those existing records. GPS location, CPU, and background-job health are shown as unavailable rather than invented. Session time is time between login and the last heartbeat, not a productivity score.

## Shared capabilities

| Area | Features |
| --- | --- |
| **Auth & roles** | Session cookie, bcrypt, Admin / Manager / Viewer (+ permission keys); product scope ERP vs CRM |
| **Notifications** | In-app bell; booking request alerts; web push for CRM task reminders |
| **Automation** | Separate ERP and CRM rule sets in SQLite. n8n email (JSON, or multipart when a file is attached). WAHA WhatsApp text and media. |
| **Search** | Global search scoped to active product |
| **Theme** | Light / dark |
| **Bulk data** | Spreadsheet import/export (`xlsx`) for accounts, payments, companies, and related flows |
| **Design-ticket UI** | Shared KPI grids, filter bars, tables, tabs |

---

## Integrations

| Integration | Use |
| --- | --- |
| **Google Calendar (+ Meet)** | CRM bookings & ERP meetings — OAuth, event upsert/delete, FreeBusy for open slots |
| **n8n webhooks** | Email channel for automation rules |
| **WAHA** | WhatsApp send / session for automation |
| **Web Push (VAPID)** | CRM task reminders to subscribed devices |
| **Country State City API** | CRM account Country → State → City (+ Buildesk India region) |
| **Portal iframe CSP** | `PORTAL_FRAME_ANCESTORS` for embedding `/portal/*` on external sites |

**Automation triggers** (examples): ticket lifecycle, booking create/status, task-before-start, payment overdue / executive remind, query response, live-chat started.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React UI (TanStack Router)                             │
│  Zustand stores ← ServerDataBootstrap on login          │
│  ERP sidebar (/)  ·  CRM sidebar (/crm)                 │
└───────────────────────────┬─────────────────────────────┘
                            │ server functions
┌───────────────────────────▼─────────────────────────────┐
│  TanStack Start / Nitro API                             │
│  Session auth · role checks · domain ops                │
│  External: CSC API, Google Calendar, n8n, WAHA, web push│
└───────────────────────────┬─────────────────────────────┘
                            │ Drizzle ORM
┌───────────────────────────▼─────────────────────────────┐
│  SQLite (better-sqlite3)                                │
│  data/buildesk.db  ·  VPS-friendly single file          │
└─────────────────────────────────────────────────────────┘
```

**Data flow**

- SQLite is the source of truth
- After login, bootstrap hydrates Zustand caches for the active product scope
- Ticket and notification polling keeps portal activity fresh
- `db:ensure` applies idempotent schema patches on deploy
- Master / Settings config syncs to an `app_config` JSON blob

**Auth**

- Cookie: `buildesk_session` (14-day)
- Passwords: bcrypt
- Routes gated by `AuthGate` via `authMe`

---

## Tech stack

| Layer | Choice |
| --- | --- |
| App framework | TanStack Start (React 19) + Vite 8 + Nitro |
| Routing | TanStack Router (file routes under `src/routes/`) |
| UI | Tailwind CSS 4, Radix, Lucide, Framer Motion, Recharts, Sonner |
| Forms | React Hook Form + Zod |
| Client state | Zustand (+ TanStack Query for some CRM domains) |
| Database | SQLite + Drizzle ORM (`better-sqlite3`) |
| Auth | httpOnly session cookie + bcrypt |
| DnD | `@dnd-kit` (Kanban, vendor flows) |
| Spreadsheets | `xlsx` |
| Google APIs | `googleapis` (Calendar + FreeBusy + Meet) |
| Runtime | Node.js **22.x** |

---

## Getting started

**Requirements:** Node.js 22.x, npm

```bash
npm ci
cp .env.example .env
# Edit .env — at minimum SESSION_SECRET; add CSC_API_KEY for CRM location picker
npm run db:setup    # schema + ensure patches + seed
npm run dev         # http://localhost:3000
```

- ERP users land on `/`
- CRM users land on `/crm`

---

## Demo accounts

Password for all seed users: **`buildesk123`**

### ERP (`productScope: erp`)

| Email | Role |
| --- | --- |
| `aditya@buildesk.com` | Admin |
| `priya@buildesk.com` | Manager |
| `rohan@buildesk.com` | Manager |
| `neha@buildesk.com` | Viewer |

### Sales CRM (`productScope: crm`)

| Email | Role |
| --- | --- |
| `ananya@crm.buildesk.com` | Admin |
| `vikram@crm.buildesk.com` | Manager |

Seed is idempotent: `npm run db:seed` skips when users already exist.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build → `.output/` |
| `npm start` / `npm run preview` | Run production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run db:push` | Apply Drizzle schema to SQLite |
| `npm run db:ensure` | Idempotent column/table patches |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | `db:push` → `db:ensure` → `db:seed` |
| `npm run db:generate` / `db:migrate` | Drizzle kit generate / migrate |
| `npm run test:crm` | CRM regression smoke check |
| `npm run android:sync` | Point the Android shell at `CAPACITOR_SERVER_URL` and sync Capacitor |
| `npm run android:open` | Open the Android project in Android Studio |
| `npm run android:run` | Sync, then run a debug build on a device or emulator |
| `npm run android:release` | HTTPS-only sync, then build a release AAB |

## Android app

The Android app is a Capacitor shell around this server. It does not bundle the database or server functions. Phone layout, cookies, back navigation, and release steps are in [ANDROID_APP.md](ANDROID_APP.md). Web development stays `npm run dev`.

---

## Environment

Copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path, e.g. `file:./data/buildesk.db` |
| `DATA_DIR` | Optional directory for `buildesk.db` on a VPS |
| `SESSION_SECRET` | Cookie signing secret (**change in production**) |
| `COOKIE_SECURE` | Set `true` only behind HTTPS |
| `NODE_ENV` | `development` or `production` |
| `VITE_PORTAL_BASE_URL` | Public portal URL prefix for copied links |
| `PORTAL_FRAME_ANCESTORS` | CSP parents allowed to iframe `/portal/*` (default `*`) |
| `APP_BASE_URL` | App URL for OAuth redirects and absolute links |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar + Meet for bookings/meetings |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push for CRM task reminders |
| `CSC_API_KEY` | [Country State City API](https://countrystatecity.in) key for CRM location picker |

Never commit production secrets. Set API keys only in server `.env`.

---

## Deployment

Designed for a single-node VPS with SQLite, PM2, and optionally Nginx + TLS.

### Manual (on the server)

```bash
git pull
bash scripts/deploy.sh
```

`scripts/deploy.sh`:

1. Ensures Node 22.x
2. Loads `.env`
3. `npm ci --include=dev`
4. `npm run db:ensure`
5. `npm run build`
6. Restarts PM2 process **`buildesk-compass`** (override with `PM2_NAME`)

Set `DATABASE_URL` to an absolute path outside the web root, e.g. `file:/home/buildesk-track/data/buildesk.db`.

Enable HTTPS before setting `COOKIE_SECURE=true`.

### Continuous deploy

GitHub Actions (`.github/workflows/deploy.yml`) deploys on push to `main` (or `workflow_dispatch`) via SSH.

Required secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`

---

## Project layout

```
src/
  routes/
    *.tsx                 # ERP pages (/, /companies, /dpr, /meetings, …)
    crm.*.tsx             # Sales CRM pages (/crm, /crm/accounts, /crm/payments, …)
    portal.$slug.*        # Client portal
  components/
    crm/                  # Accounts, onboarding hub, payments, bookings, dashboard
    design-ticket/        # Shared ticket UI kit (KPI grid, filters, tables)
    support/              # Support Desk form + Kanban
    chat/                 # Portal widget, live-chat, notifications
    automation/           # n8n / WAHA panels
    dpr/                  # Daily progress reports
  stores/                 # Zustand domain stores + CRM dashboard selectors
  server/
    api/                  # Server functions (auth, CRM, ERP, bookings, payments, …)
    lib/                  # CSC, payments, portal headers, task schedule, …
    db/                   # Drizzle schema
    google/               # Calendar OAuth + FreeBusy + Meet
  hooks/                  # Payments, DPR, web push, session filters, reminders
  lib/                    # API wrappers, nav, CRM activity/payments, permissions
  types/                  # Shared TypeScript models
  data/                   # Seed, CRM/ERP defaults, chatbot knowledge
  services/               # WAHA, chatbot, automation helpers
scripts/
  db-ensure-schema.mjs
  db-seed.ts
  deploy.sh
  crm-regression-check.mjs
data/                     # SQLite file (local)
.github/workflows/        # Autodeploy
```

---

## Typical flows

### CRM onboarding manager

1. Create **CRM account** with managers, location, modules, and commercial terms
2. Open account hub → complete **Sales CRM** checklists (masters → migration → training → reports)
3. Configure **integrations** as opted in
4. Run **go-live verification** (account moves to Live; progress syncs)
5. Share **portal link** — clients book calls and raise tickets
6. Track **payments**, **usage**, **tasks**, **queries**, **broadcasts**, **win-back**, and **activity history**
7. Approve **meeting** requests → Join Meet → **End meeting** early if needed to free the calendar

### ERP implementation manager

1. Create **company** → opt into modules → add **projects**
2. Run onboarding checklist, migration uploads, required documents
3. **Go live** on projects → post-sales where sold
4. Log **DPR** daily; managers review **DPR Tracker**
5. Schedule **ERP meetings** and **client visits**
6. Share portal links; monitor tickets and live chat

### Client (portal)

1. Open `/portal/{slug}`
2. Create / track tickets; book a call; chat with Buildesk Assistant or live agents

---

## License

Private — Buildesk internal use.
