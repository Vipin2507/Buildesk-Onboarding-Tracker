# Buildesk Onboarding Tracker

Internal operations platform for **Buildesk** — track real-estate CRM/ERP clients from company signup through module adoption, project onboarding, data migration, go-live, post-sales, support, training, renewals, and reporting.

Built for onboarding managers, CSMs, and admins who need one place to run implementation — not a customer-facing portal.

---

## Table of contents

- [Overview](#overview)
- [Who it’s for](#who-its-for)
- [Product walkthrough](#product-walkthrough)
- [Feature reference](#feature-reference)
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

Buildesk Onboarding Tracker replaces scattered sheets and chat with a structured lifecycle:

1. **Company** is created with plan, health, managers, and module opt-ins  
2. **Projects** are onboarded with checklists, documents, migrations, and go-live gates  
3. **Post-sales** workflows continue after live where needed  
4. **Support, training, renewals, and reports** keep the account healthy  

The app ships with seed data sized for real ops use (dozens of companies and hundreds of projects) so demos and local development feel like production.

---

## Who it’s for

| Role | Typical use |
| --- | --- |
| **Admin** | Master config, users, permissions, full CRUD |
| **Manager** | Day-to-day onboarding, tickets, training, renewals |
| **Viewer** | Read-heavy visibility across companies and progress |

Permissions are configurable under **Settings → Roles**.

---

## Product walkthrough

### 1. Sign in

- Session-based auth (httpOnly cookie, bcrypt passwords)
- Login and register on `/login`
- Profile editing (avatar, contact, notification prefs, password)
- Light / dark theme

### 2. Dashboard

At-a-glance ops view:

- KPI cards (companies, active onboarding, completed, on hold, pending work, renewals)
- Progress and module-adoption charts
- Account health snapshot
- Recent activity feed
- Upcoming renewals

### 3. Companies → Projects → Go live

```
Company
  ├── Modules & add-ons
  ├── Projects
  │     ├── Progress tracker
  │     ├── Onboarding checklist
  │     ├── Data migration
  │     ├── Documents (required → checklist)
  │     ├── Customer app
  │     ├── Vendors / Labor / Integrations / Training
  │     ├── Tickets (project-scoped)
  │     └── Go Live
  ├── Notes & files
  ├── History
  └── Billing / renewals context
```

### 4. After go-live

- **Post-sales** project trackers (template → upload → approval style steps)
- **Support Desk** for bugs, customizations, and requirements
- **Training** sessions and recordings
- **Renewals** against plan expiry
- **Reports** for leadership and delivery metrics

---

## Feature reference

### Navigation modules

| Module | Route | Capabilities |
| --- | --- | --- |
| **Dashboard** | `/` | KPIs, charts, activity, renewals preview |
| **Companies** | `/companies` | CRUD, status chips, plan/health/progress/manager/city/date filters, sort, module opt-in |
| **Company detail** | `/companies/$id` | Details, modules, progress, projects, notes & files, history, billing |
| **Projects** | `/projects` | Global list with status filters and navigation into workspaces |
| **Project workspace** | `/projects/$id` | Tabbed hub for the full onboarding lifecycle (below) |
| **Onboarding Tracker** | `/onboarding` | Active onboardings with progress → jump into project |
| **Modules & Add-ons** | `/modules` | Adoption across Post Sales, Vendor, Labor, Customer App, Construction, Project Mgmt |
| **Data Migration** | `/data-migration` | Unit / customer / booking / payment Excel upload UX + verification |
| **Document Templates** | `/documents` | Template cards: draft → live, upload, delete |
| **Customer App** | `/customer-app` | Buildesk vs white-label branding, support contacts, publish |
| **Vendor Management** | `/vendors` | Materials, suppliers, contractors, POs, WOs, BOQ, approval-flow DnD |
| **Labor Management** | `/labor` | Labor roster KPIs, attendance Excel upload history |
| **Integrations & Triggers** | `/integrations` | Connect/test integrations; event → channel triggers CRUD |
| **Training** | `/training` | Sessions (type, trainer, company, attendance, recording, status) |
| **Support Desk** | `/support` | Global tickets: filters, list, Kanban, detail |
| **Renewals** | `/renewals` | Upcoming / overdue plan expiry; mark renewed |
| **Employees** | `/employees` | Managers & CSMs; transfer companies between managers |
| **Reports** | `/reports` | Multiple report types with charts/tables + CSV export |
| **Master Config** | `/master` | Platform fields, picklists, inventory, workflow, checklist defs, templates, modules, integrations, reset |
| **Settings** | `/settings` | Appearance, org profile, notifications, documents, Excel templates, payment plans, roles, users |

### Project workspace tabs

| Tab | What you can do |
| --- | --- |
| **Progress Tracker** | Milestone checks, N/A, contacts, mark-all, % complete |
| **Onboarding** | Multi-step wizard + section checklist (project, unit, customer, payment, documents, integrations, go-live) with collected / uploaded / live / N/A / remarks; other charges |
| **Data Migration** | Sheet-oriented upload flow for that project |
| **Documents** | Mark templates **Required** — each required doc becomes an onboarding checklist item (`required-document`) |
| **Customer App** | App branding and publish settings |
| **Vendors / Labor / Integrations / Training** | Scoped entry points into those domains |
| **Tickets** | Create and manage tickets **for this project** |
| **Go Live** | Gated on go-live checklist completion; marks project live and can notify in-app |

### Support & notifications

**Support Desk**

- Ticket types: Bug, Customization, Requirement  
- Priority: Critical → Low  
- Status pipeline: New → Assigned → In Progress → QA → Ready for Release → Released → Closed  
- Always tied to a **company** and **project**  
- Description, ETA (themed date picker), assignee  
- Filters: search, status, priority, type, company, project, raised-on range, sort  
- **Kanban** board with drag-and-drop (`@dnd-kit`)  
- Full detail page: edit, status change, delete, links to company & project  

**In-app notifications**

- Top-bar bell with unread badge  
- Emitted on ticket create, status change, reassignment (and optionally project go-live)  
- Mark one / mark all read; click opens the ticket  
- Respects profile **notify in-app** and Settings notification toggles  

### Cross-cutting UX

- Collapsible sidebar + mobile navigation sheet  
- Global search (companies & projects)  
- Shared **ListToolbar**: search, chips, selects, date range (themed picker), sort, clear, result counts  
- Framer Motion page transitions and detail motion  
- Toast feedback (Sonner)  
- Light / dark theme toggle  
- Responsive layouts for desk and field use  

### Reports (examples)

Onboarding progress, due items, collections, vendor, labor, team load, delays, integrations, ticket aging, bug resolution, custom views, and executive summaries — each with chart/table output and CSV download where applicable.

### Master Config & Settings

- **Master**: company/project custom fields, picklists, inventory catalog, workflow steps, onboarding checklist definitions, document/Excel templates, module catalog, integrations, data control / reset  
- **Settings**: org branding & support contacts, SMTP / digest / event alerts (approvals, tickets, renewals, go-live), document defaults, Excel import templates, payment plan presets, role permissions, user invite  

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React UI (TanStack Router)                             │
│  Zustand stores ← ServerDataBootstrap on login          │
└───────────────────────────┬─────────────────────────────┘
                            │ server functions
┌───────────────────────────▼─────────────────────────────┐
│  TanStack Start / Nitro API                             │
│  Session auth · role checks · domain ops                │
└───────────────────────────┬─────────────────────────────┘
                            │ Drizzle ORM
┌───────────────────────────▼─────────────────────────────┐
│  SQLite (better-sqlite3)                                │
│  data/buildesk.db  ·  Hostinger-friendly single file    │
└─────────────────────────────────────────────────────────┘
```

**Data flow**

- SQLite is the source of truth for entities (companies, projects, tickets, checklist, etc.)  
- After login, `ServerDataBootstrap` hydrates Zustand caches used by screens  
- Optimistic UI updates sync back through server functions  
- **Master** and **Settings** also persist locally and sync into an `app_config` JSON blob  
- `db:ensure` safely patches missing columns/tables on existing databases (no destructive migrate required for common ops patches)  

**Auth**

- Cookie: `buildesk_session` (14-day)  
- Passwords hashed with bcrypt  
- Routes gated by `AuthGate` via `authMe`  

---

## Tech stack

| Layer | Choice |
| --- | --- |
| App framework | TanStack Start (React 19) + Vite 8 + Nitro |
| Routing | TanStack Router (file routes under `src/routes/`) |
| UI | Tailwind CSS 4, Radix-based components, Lucide, Framer Motion, Recharts, Sonner |
| Forms | React Hook Form + Zod |
| Client state | Zustand |
| Database | SQLite + Drizzle ORM (`better-sqlite3`) |
| Auth | httpOnly session cookie + bcrypt |
| DnD | `@dnd-kit` (Support Kanban, vendor approval stages) |
| Spreadsheets | `xlsx` (sample / import UX) |
| Runtime | Node.js **22.x** |

---

## Getting started

**Requirements:** Node.js 22.x, npm

```bash
npm ci
cp .env.example .env
npm run db:setup    # schema + ensure patches + seed
npm run dev         # http://localhost:3000
```

Open the app, sign in with a demo account below, and start from **Dashboard** or **Companies**.

---

## Demo accounts

Password for all seed users: `buildesk123`

| Email | Role |
| --- | --- |
| `aditya@buildesk.com` | Admin |
| `priya@buildesk.com` | Manager |
| `rohan@buildesk.com` | Manager |
| `neha@buildesk.com` | Viewer |

Seed is idempotent: `npm run db:seed` skips when users already exist.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build → `.output/` |
| `npm start` | Run production server (`node .output/server/index.mjs`) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run db:push` | Apply Drizzle schema to SQLite |
| `npm run db:ensure` | Idempotent column/table patches |
| `npm run db:seed` | Seed demo data (no-op if users exist) |
| `npm run db:setup` | `db:push` → `db:ensure` → `db:seed` |
| `npm run db:generate` / `db:migrate` | Drizzle kit generate / migrate |

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

---

## Deployment

Designed for a single-node VPS (e.g. **Hostinger KVM**) with SQLite, PM2, and optionally Nginx + TLS.

### Manual (on the server)

```bash
# In the app directory (default /var/www/buildesk)
git pull
bash scripts/deploy.sh
```

`scripts/deploy.sh` will:

1. `npm ci`  
2. Apply schema (`drizzle-kit push`, then `npm run db:ensure`)  
3. `npm run build`  
4. Restart or start the PM2 process named **`buildesk`**

Point Nginx (or your reverse proxy) at the Node process and enable HTTPS before setting `COOKIE_SECURE=true`.

### Continuous deploy

GitHub Actions (`.github/workflows/deploy.yml`) deploys on push to `main` (or `workflow_dispatch`) via SSH:

- Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`  
- Remote: hard-reset to `origin/main`, then run `scripts/deploy.sh`  

---

## Project layout

```
src/
  routes/           # File-based pages (dashboard, companies, projects, support, …)
  components/       # UI, toolbars, panels, date picker, notifications bell
  stores/           # Zustand domain stores
  server/           # Auth, Drizzle schema, server functions
  types/            # Shared TypeScript models
  data/             # Seed + constants
  lib/              # API client wrappers, nav, sync helpers
scripts/
  db-ensure-schema.mjs
  db-seed.ts
  deploy.sh
data/               # SQLite file (local)
.github/workflows/  # Autodeploy
```

---

## Typical operator flow

1. **Invite / assign** employees (managers, CSMs)  
2. **Create company** → choose plan, modules, targets  
3. **Add projects** → open Progress + Onboarding checklist  
4. Mark **required documents**; run **data migration** uploads  
5. Complete go-live checklist → **Go Live**  
6. Track **post-sales** where sold; raise **tickets** per project  
7. Schedule **training**; watch **renewals** and **reports**  
8. Tune **Master Config** and **Settings** as the catalog evolves  

---

## License

Private — Buildesk internal use.
