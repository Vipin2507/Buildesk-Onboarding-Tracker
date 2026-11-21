# ERP Tracker Dashboard

The ERP Tracker Dashboard is the home screen for Buildesk Compass users whose product is **ERP** (`productScope: erp`). It lives at **`/`** and is the first stop for implementation managers: what is stuck today, how the portfolio is moving, and which company to open next.

The page does not edit companies itself. Almost every number is a filter. Clicking it opens a side sheet with the matching records, and from there you jump into the company, project, ticket, task, or visit.

---

## Who uses it

| Role | What they do here |
| --- | --- |
| Onboarding / implementation manager | See their queue: overdue follow-ups, checklist phases, companies in progress |
| Support | Spot open internal tickets and client portal tickets |
| Admin | Same view across the whole ERP portfolio, plus **+ New Onboarding** |

CRM users land on `/crm` instead. This dashboard is the ERP company and project portfolio, not the CRM payments board.

---

## How the page is laid out

The screen is one scrolling page, top to bottom:

1. **Header** — title, one-line purpose, and the create action
2. **Pending overview** — today’s work as clickable chips
3. **Portfolio KPIs** — company counts by onboarding status
4. **Onboarding pipeline** — checklist items by phase
5. **Three charts** — status mix, modules opted, account health
6. **Recent onboarding** and **Recent activity**
7. **Drill-down sheet** — slides in from the side when anything above is clicked

The header subtitle is “Pending work and portfolio status at a glance.” **+ New Onboarding** goes to `/companies`, where a company is created.

---

## 1. Pending overview

This is the working queue. The caption shows how many items are open. A red pill appears when anything in that queue is overdue (“N overdue in queue”).

Each chip shows a count. Clicking it opens the drill-down sheet and highlights the chip until you close the sheet.

| Chip | What it counts | What the sheet lists |
| --- | --- | --- |
| **Overdue** | Follow-up tasks whose due date is already past and still open | Those tasks |
| **Due today** | Follow-ups due today | Those tasks |
| **Support tickets** | Open internal Support Desk tickets (`TKT-*`) | Ticket title and status |
| **Client tickets** | Open client portal tickets (`DT-*`) that are not resolved or closed | Ticket number and subject |
| **Follow-ups** | Open ERP follow-up tasks | Those tasks |
| **To collect** | Checklist items still waiting for the client to send data | Items grouped by company |
| **To upload** | Checklist items the team still has to load into the ERP | Items grouped by company |
| **To go live** | Checklist items waiting on go-live | Items grouped by company |
| **Visit follow-ups** | Client visits that still need a follow-up | Visit purpose and next date |
| **Upcoming visits** | Visits scheduled ahead | Those visits |
| **Renewals** | Companies whose plan expiry is inside the upcoming renewal window | Those companies |

The overdue chip is only overdue **follow-up tasks**. It is not the CRM payments overdue amount.

---

## 2. Portfolio KPI cards

Four compact cards sit under the queue. Clicking a card filters the same drill-down to companies in that computed onboarding status.

| Card | Meaning |
| --- | --- |
| **Companies** | Every ERP company in the portfolio |
| **In progress** | Onboarding has started and is not finished |
| **Completed** | Onboarding checklist is complete |
| **On hold** | Work is paused |

Status on these cards is the **computed** onboarding status (from checklist progress), shown later as a status pill on each company. It is not the commercial account status used in CRM.

---

## 3. Onboarding pipeline

The pipeline is the checklist, not the company count. One company can contribute items to more than one phase.

A stacked bar shows the share of items in each phase. Under it, four cards are clickable:

| Phase | Meaning | Typical next step |
| --- | --- | --- |
| **Awaiting Collection** | The team is still waiting on the client for masters, formats, or historical data | Chase the client; the company-created kickoff email and WhatsApp exist for this handoff |
| **Awaiting Upload** | Data is in hand and still needs to be loaded | Open the project checklist and finish the upload items |
| **Awaiting Go-Live** | Setup is done enough to verify and go live | Open the project go-live tab |
| **Fully Complete** | Those checklist items are done | No action unless a new module is added |

The header also shows how far the applicable checklist has progressed overall. The active phase stays highlighted while its sheet is open.

---

## 4. Charts

### Onboarding mix

A donut of companies by computed status:

- Completed
- In progress
- Pending review
- Not started
- On hold

The center chart and the legend under it are both clickable. A click opens the company list for that slice. Pending review and Not started appear here even though they do not have their own KPI card.

### Modules opted

A bar chart of how many companies have opted into each ERP module (Post Sales, Vendor, Labor, Customer App, and the rest of the catalog). The caption is the company count. This chart is read-only; module changes happen on the company, not here.

### Account health

A ring shows the share of companies marked **Healthy**. Beside it:

| Band | Use |
| --- | --- |
| **Healthy** | On track |
| **Moderate** | Needs attention |
| **Critical** | Behind or at risk |

Each row is clickable and opens those companies in the sheet.

---

## 5. Recent onboarding

The four companies that are **not completed**, sorted by highest checklist progress. This is “closest to done,” not “newest.”

| Column | What you see |
| --- | --- |
| Company | Name. Click to open `/companies/$companyId` |
| Status | Computed status pill |
| Progress | Bar and percent |
| Manager | Onboarding manager |
| Open | Shown when the company has a project. Opens that project on the **onboarding** tab |

On a narrow screen the same rows become cards instead of a table. **View all** goes to `/companies`.

---

## 6. Recent activity

The last four portfolio events (checklist updates, status changes, and similar). Each line is what happened, who did it, and how long ago. The dot color marks the tone: success, warning, danger, or neutral. This list is a feed, not a filter.

---

## 7. Drill-down sheet

Any chip, KPI, pipeline phase, donut slice, or health band opens the same sheet. It is the working list for that filter.

What the sheet can contain:

- **Companies** — name, status pill, progress, link into the company
- **Checklist groups** — companies expanded to the items in that phase (collection, upload, go-live, or complete)
- **Support tickets** and **client tickets**
- **Follow-ups** and visit follow-ups, with due dates
- **Upcoming visits**
- **Renewals**

The sheet has a search field so a long list can be narrowed without leaving the dashboard. Closing it clears the highlight on the chip or card you clicked.

From a row you leave the dashboard and continue in the real record:

| From | You land on |
| --- | --- |
| Company name | Company hub `/companies/$companyId` |
| Project **Open** | Project onboarding tab |
| Ticket | Support Desk or Ticket Tracking |
| Task / visit | Tasks or Client Visits |

---

## Daily workflow

```text
Open Dashboard (/)
        │
        ▼
Pending overview ── click the red or amber chip first
        │            (overdue, due today, to collect, to upload, to go live)
        ▼
Drill-down sheet ── search if the list is long
        │
        ├── Follow-up / visit ── complete or reschedule it
        ├── Ticket ── reply or assign it
        └── Checklist item ── open the company or project
                    │
                    ▼
        Company hub or project onboarding tab
                    │
                    ▼
        Update the checklist item
                    │
                    ▼
        Return to Dashboard — the chip count drops
```

A normal morning:

1. Open **Overdue**, then **Due today**. Clear or reschedule those follow-ups.
2. Open **To collect** for anything blocked on the client, and **To upload** / **To go live** for work the team owns.
3. Check **Support tickets** and **Client tickets** if those chips are non-zero.
4. Use **In progress** or the donut if you need a company that is not in today’s queue.
5. Use **Recent onboarding** when you want the implementations nearest to completion.

**+ New Onboarding** is the start of a new company, not a task inside the queue. After the company exists, its checklist items show up in the pipeline and the pending chips.

---

## Where the numbers come from

| UI | Source |
| --- | --- |
| Company KPIs, donut, recent onboarding | ERP companies and their checklist progress |
| Pipeline and collect / upload / live chips | Onboarding checklist items, bucketed by phase |
| Follow-up chips | ERP tasks |
| Visit chips | Client visits |
| Support / client ticket chips | Support Desk tickets and portal design tickets |
| Renewals | Company plan expiry inside the renewal window |
| Modules chart | Module opt-ins on companies |
| Account health | Company health band (Healthy / Moderate / Critical) |
| Activity | Latest activity events |

The page reads the stores already loaded for the signed-in user. It does not send mail or WhatsApp by itself. Company-created kickoff messages are sent when a company is created, from Automation, not from this screen.

---

## What this dashboard is not

- It is not the **CRM dashboard** (`/crm`) and not **CRM Payments**.
- It does not edit checklist items inline. It routes you to the company or project.
- The **Overdue** chip is overdue follow-up tasks, not unpaid invoices.
- Secondary tools (Onboarding Tracker, DPR, Meetings, Master, Automation) stay in the sidebar or under Settings. The dashboard only surfaces the counts that need attention today.
