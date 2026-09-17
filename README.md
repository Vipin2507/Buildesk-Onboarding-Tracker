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
| **Dashboard** | `/crm` | Portfolio KPIs, pending work chips, module adoption, health, recent tasks & queries, activity preview |
| **Accounts** | `/crm/accounts` | CRM customer accounts — filters, bulk upload/export, date bulk update, API-key bulk, client transfer, commercial fields |
| **Payments** | `/crm/payments` | Collection board — installment allocation, ledger, renewals, reminders |
| **Meetings** | `/crm/bookings` | Portal booking requests, executive availability, Google Calendar + Meet, end-early |
| **Tasks** | `/crm/tasks` | Follow-up tasks — calendar views, assignees, reminders (incl. Reminder type) |
| **Account queries** | `/crm/queries` | Internal account discussions — create, filter, search, attachments, mentions |
| **Activity history** | `/crm/activity` | Unified feed — visits, tasks, bookings, tickets, tracker, modules, queries |
| **Support Desk** | `/crm/support` | Internal `TKT-*` engineering tickets |
| **Ticket Tracking** | `/crm/tickets` | Client `DT-*` portal tickets |
| **Live Chat** | `/crm/live-chat` | Portal chat inbox |
| **Automation** | `/crm/automation` | CRM rules — bookings, task reminders, payments, n8n / WAHA (admin) |
| **Master** | `/crm/master` | CRM catalogs — modules, migration/training/report checklists, call types, booking defaults (admin) |
| **Settings** | `/crm/settings` | CRM org settings, users, web push devices, Google Calendar |

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

---

## ERP Onboarding Tracker

Route prefix: **`/`** (default for `productScope: erp`). Navigation in `src/lib/nav.ts`.

### ERP navigation

| Module | Route | Purpose |
| --- | --- | --- |
| **Dashboard** | `/` | Company/project KPIs, pipeline, module adoption, health, charts |
| **Companies** | `/companies` | Company CRUD and company hub |
| **Onboarding Tracker** | `/onboarding` | Cross-company checklist / pipeline view |
| **Modules & Add-ons** | `/modules` | Opt-in ERP modules (Post Sales, Vendor, Labor, Customer App, Construction, Project Mgmt, …) |
| **Data Migration** | `/data-migration` | Migration checklists / uploads |
| **Document Templates** | `/documents` | Template + required-doc tracking |
| **Customer App** | `/customer-app` | Customer-app rollout tracking |
| **Vendor Management** | `/vendors` | Vendor flows (incl. DnD) |
| **Labor Management** | `/labor` | Labor tracking |
| **Integrations & Triggers** | `/integrations` | Integration / trigger setup |
| **Training** | `/training` | Training sessions |
| **Support Desk** | `/support` | Internal `TKT-*` tickets |
| **Ticket Tracking** | `/tickets` | Client `DT-*` tickets |
| **Live Chat** | `/live-chat` | Portal chat inbox |
| **Tasks** | `/tasks` | ERP follow-up tasks |
| **My DPR** | `/dpr` | Daily progress report entries, templates, day submit |
| **DPR Tracker** | `/dpr/tracker` | Manager view — executive DPR compliance |
| **Meetings** | `/meetings` | ERP meetings (types, formats, status), list + calendar, Google Calendar |
| **Client Visits** | `/client-visits` | Field visit logging |
| **Renewals** | `/renewals` | Renewal / billing lifecycle |
| **Employees** | `/employees` | Staff directory |
| **Reports** | `/reports` | Operational reports |
| **Master Config** | `/master` | Catalogs (admin) |
| **Automation** | `/automation` | n8n / WAHA rules (admin) |
| **Settings** | `/settings` | Org config, users, permissions |

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

### Company hub tabs

Overview · Modules · Progress · Projects · Tickets · Tasks · Meetings · Visits · Notes · History · Billing

### Daily Progress Reports (DPR)

| View | Route | Audience |
| --- | --- | --- |
| **My DPR** | `/dpr` | Executives log daily work — templates, categories, priorities, day submit |
| **DPR Tracker** | `/dpr/tracker` | Managers filter/search compliance across executives |

### ERP Meetings

- Meeting types (kickoff, training, review, demo, check-in, …) and formats (online, in person, phone)
- Statuses: scheduled, completed, cancelled, postponed, no-show
- List + calendar views; optional Google Calendar sync for online meetings

---

## Client portal

Per-company or per-CRM-account portal at **`/portal/{slug}`**:

| Page | Purpose |
| --- | --- |
| Dashboard | KPI cards, recent tickets, booking status |
| Create ticket | Self-service request form |
| My Tickets / Solved | Active and closed ticket lists |
| Book a call | Cal.com-style slot booking (CRM) |
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

## Shared capabilities

| Area | Features |
| --- | --- |
| **Auth & roles** | Session cookie, bcrypt, Admin / Manager / Viewer (+ permission keys); product scope ERP vs CRM |
| **Notifications** | In-app bell; booking request alerts; web push for CRM task reminders |
| **Automation** | n8n (email) + WAHA (WhatsApp) — tickets, bookings, tasks, payments, queries, live chat |
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
6. Track **payments**, **tasks**, **queries**, and **activity history** from dashboard and hubs
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
