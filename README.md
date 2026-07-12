# Buildesk Onboarding Tracker

Internal onboarding & post-sales tracker for Buildesk.

## Stack

- TanStack Start (React) + Vite + Nitro
- Drizzle ORM + **SQLite** (Hostinger KVM1 friendly)
- Session auth (httpOnly cookie + bcrypt)

## Quick start (local)

```bash
npm ci
cp .env.example .env
npm run db:setup    # create schema + seed 53 companies / 189 projects
npm run dev         # http://localhost:3000
```

Demo login: `aditya@buildesk.com` / `buildesk123`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build & run |
| `npm run db:push` | Apply schema to SQLite |
| `npm run db:seed` | Seed data (skips if users exist) |
| `npm run db:setup` | push + seed |
| `npm run typecheck` | TypeScript |

## Deploy (Hostinger KVM1)

- Manual: [DEPLOY.md](./DEPLOY.md) — PM2 + Nginx + HTTPS + SQLite
- Auto (GitHub Actions): [AUTODEPLOY.md](./AUTODEPLOY.md) — push `main` → VPS
