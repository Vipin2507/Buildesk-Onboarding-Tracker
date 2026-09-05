# Buildesk Compass

Internal operations platform for **Buildesk** — track real-estate **ERP** clients and **Sales CRM** accounts from signup through module adoption, onboarding, go-live, support, training, renewals, and reporting.

The app ships as two products in one codebase. Each user has a `productScope` (`erp` or `crm`) that controls their home route, sidebar, and search scope.

| Product | Home | Audience |
| --- | --- | --- |
| **ERP Onboarding Tracker** | `/` | ERP implementation — companies, projects, post-sales |
| **Sales CRM** | `/crm` | CRM onboarding — accounts, Sales CRM modules, meetings, tasks |

Both products share authentication, SQLite storage, automation hooks, client portals, ticket tracking, live chat, and the design-ticket UI kit.

---

## Table of contents

- [Overview](#overview)
- [Sales CRM](#sales-crm)
- [ERP Onboarding Tracker](#erp-onboarding-tracker)
- [Client portal](#client-portal)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Demo accounts](#demo-accounts)
- [Scripts](#scripts)
- [Environment](#environment)
- [Deployment](#deployment)
- [Project layout](#project-layout)

---

## Overview

Buildesk Compass replaces scattered sheets and chat with structured lifecycle tracking:

1. **Account / company** is created with plan, managers, commercial terms, and module opt-ins  
2. **Onboarding** runs through checklists — masters, migration, training, reports, integrations  
3. **Go-live** gates production readiness  
4. **Post go-live** — support tickets, tasks, meetings, queries, training, renewals, and reports  

Seed data includes ERP companies/projects and CRM accounts so local development feels like production.

---

## Sales CRM

Route prefix: **`/crm`**. Navigation is defined in `src/lib/crm-nav.ts`.

### CRM navigation

| Module | Route | Purpose |
| --- | --- | --- |
| **Dashboard** | `/crm` | Portfolio KPIs, pending work chips, module adoption, health, recent tasks & queries, activity preview |
| **Accounts** | `/crm/accounts` | CRM customer accounts — filters, bulk upload, date bulk update, client transfer, commercial fields |
| **Meetings** | `/crm/bookings` | Portal booking requests, executive availability, Google Calendar sync |
| **Tasks** | `/crm/tasks` | Follow-up tasks across accounts — calendar, assignees, reminders |
| **Account queries** | `/crm/queries` | Internal account discussions — create, filter, search |
| **Activity history** | `/crm/activity` | Unified feed — visits, tasks, bookings, tickets, tracker, modules, queries |
| **Support Desk** | `/crm/support` | Internal `TKT-*` engineering tickets |
| **Ticket Tracking** | `/crm/tickets` | Client `DT-*` portal tickets |
| **Live Chat** | `/crm/live-chat` | Portal chat inbox |
| **Automation** | `/crm/automation` | CRM rules — bookings, task reminders, n8n / WAHA (admin) |
| **Master** | `/crm/master` | CRM catalogs — modules, migration/training/report checklists, call types, booking defaults (admin) |
| **Settings** | `/crm/settings` | CRM org settings, users, web push, Google Calendar |

### Account workspace

Each CRM account opens a hub at `/crm/accounts/$accountId` with tabs:

| Tab | Purpose |
| --- | --- |
| **Dashboard** | Health, progress, module cards, tracker summary, quick links |
| **Modules** | Opted product modules with progress; drill into Sales CRM sections |
| **Go live** | Verification checklist (integration-gated items) |
| **Tasks** | Account-scoped follow-up tasks |
| **Meetings** | Bookings linked to the account |
| **Tickets** | Portal / support tickets for the account |
| **Queries** | Threaded internal queries with attachments & mentions |
| **Comms** | Communication log |
| **Portal** | Client portal link and booking summary |

**Sales CRM module** (`/crm/accounts/$accountId/modules/sales-crm`) includes:

- **Integrations** — WhatsApp, SMS, Email, portal integrations (opt-in gated)  
- **Masters** — master data checklist with status filters (Pending / Completed / N/A)  
- **Migration** — data migration checklist  
- **Training** — training sessions with multi-session history  
- **Reports** — client report explanation checklist  

Overall account progress weights **Sales CRM at 90%**; each additional opted module contributes equally from the remaining 10%.

### CRM account creation

The account form includes:

- Commercial terms (deal size, installments, users purchased)  
- Sales manager, Support manager 1 & 2  
- **Location** — Country → State → City via [Country State City API](https://countrystatecity.in) (server-proxied; requires `CSC_API_KEY`)  
- Auto **Buildesk region** (NCR / South / West / Rest of India) from Indian states  
- Optional portal API key (URL slug) and module picker on create  

### CRM dashboard highlights

- Open / overdue / due-today **tasks**, open **queries**, go-live pending counts  
- Drill-down to filtered account lists  
- **Modules opted** chart (core modules only — integrations excluded)  
- Recent open tasks (with assignees) and queries  
- Session-persisted filters across list pages  

---

## ERP Onboarding Tracker

Route prefix: **`/`** (default for `productScope: erp`). Navigation in `src/lib/nav.ts`.

### ERP navigation (summary)

| Module | Route |
| --- | --- |
| Dashboard | `/` |
| Companies | `/companies` |
| Onboarding Tracker | `/onboarding` |
| Modules & Add-ons | `/modules` |
| Data Migration | `/data-migration` |
| Document Templates | `/documents` |
| Customer App | `/customer-app` |
| Vendor / Labor / Integrations | `/vendors`, `/labor`, `/integrations` |
| Training | `/training` |
| Support Desk | `/support` |
| Ticket Tracking | `/tickets` |
| Live Chat | `/live-chat` |
| Tasks / Client Visits | `/tasks`, `/client-visits` |
| Renewals / Employees / Reports | `/renewals`, `/employees`, `/reports` |
| Master Config / Automation / Settings | `/master`, `/automation`, `/settings` |

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
  └── Billing / renewals context
```

---

## Client portal

Per-company or per-CRM-account portal at **`/portal/{slug}`**:

| Page | Purpose |
| --- | --- |
| Dashboard | KPI cards, recent tickets |
| Create ticket | Self-service request form |
| My Tickets / Solved | Active and closed ticket lists |
| Book a call | Cal.com-style slot booking (CRM) |
| Profile | Contact details |

- **Buildesk Assistant** chatbot with knowledge base and escalation to live agents  
- Booking status visible on portal dashboard (pending / confirmed / declined / postponed)  
- Portal base URL configured via `VITE_PORTAL_BASE_URL`  

### Two ticket systems

| | **Ticket Tracking** (`DT-*`) | **Support Desk** (`TKT-*`) |
| --- | --- | --- |
| **Raised by** | Clients via portal | Internal team |
| **Scope** | Company / account design & support | Engineering pipeline |
| **ERP routes** | `/tickets` | `/support` |
| **CRM routes** | `/crm/tickets` | `/crm/support` |

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
| Client state | Zustand |
| Database | SQLite + Drizzle ORM (`better-sqlite3`) |
| Auth | httpOnly session cookie + bcrypt |
| DnD | `@dnd-kit` (Kanban, vendor flows) |
| Spreadsheets | `xlsx` |
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
| `npm start` | Run production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run db:push` | Apply Drizzle schema to SQLite |
| `npm run db:ensure` | Idempotent column/table patches |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | `db:push` → `db:ensure` → `db:seed` |
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
| `APP_BASE_URL` | App URL for OAuth redirects and absolute links |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar + Meet for CRM bookings |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push for CRM task reminders |
| `CSC_API_KEY` | [Country State City API](https://countrystatecity.in) key for CRM account location picker |

Never commit production secrets. Set `CSC_API_KEY` and other keys only in server `.env`.

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
    *.tsx              # ERP pages (/, /companies, /projects, …)
    crm.*.tsx          # Sales CRM pages (/crm, /crm/accounts, …)
    portal.$slug.*     # Client portal
  components/
    crm/               # CRM UI — accounts, onboarding hub, checklists, bookings, dashboard
    design-ticket/     # Shared ticket UI kit (KPI grid, filters, tables)
    support/           # Support Desk form + Kanban
    chat/              # Portal widget, live-chat, notifications
    automation/        # n8n / WAHA panels
  stores/              # Zustand domain stores + CRM dashboard selectors
  server/
    api/               # Server functions (auth, CRM, ERP, bookings, locations, …)
    lib/csc-api.ts     # Country State City API proxy + cache
    db/                # Drizzle schema
  hooks/               # Session filters, web push, task reminders, …
  lib/                 # API wrappers, nav, CRM activity feed, permissions
  types/               # Shared TypeScript models
  data/                # Seed, CRM defaults, chatbot knowledge
scripts/
  db-ensure-schema.mjs
  db-seed.ts
  deploy.sh
  crm-regression-check.mjs
data/                  # SQLite file (local)
.github/workflows/     # Autodeploy
```

---

## Typical flows

### CRM onboarding manager

1. Create **CRM account** with managers, location, modules, and commercial terms  
2. Open account hub → complete **Sales CRM** checklists (masters → migration → training → reports)  
3. Configure **integrations** as opted in  
4. Run **go-live verification**  
5. Share **portal link** — clients book calls and raise tickets  
6. Track **tasks**, **queries**, and **activity history** from dashboard and hubs  

### ERP implementation manager

1. Create **company** → opt into modules → add **projects**  
2. Run onboarding checklist, migration uploads, required documents  
3. **Go live** on projects → post-sales where sold  
4. Share portal links; monitor tickets and live chat  

---

## License

Private — Buildesk internal use.
