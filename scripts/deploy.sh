#!/usr/bin/env bash
# Run on the VPS from the app directory after git pull.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/home/buildesk-track/htdocs/track.cravingcodetech.in}"
PM2_NAME="${PM2_NAME:-buildesk-compass}"
cd "$APP_DIR"

echo "==> Node $(node -v) | npm $(npm -v)"
echo "==> APP_DIR=$APP_DIR PM2_NAME=$PM2_NAME"

# Load production env for build + PM2 (PORT, DATABASE_URL, SESSION_SECRET, …)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "==> Loaded .env"
else
  echo "==> WARNING: no .env found in $APP_DIR"
fi

# Full install: vite / nitro / drizzle-kit / tsx live in devDependencies.
echo "==> Installing dependencies"
npm ci

echo "==> Applying DB schema patches (safe / non-interactive)"
# Prefer db:ensure over drizzle-kit push — push can prompt for destructive drops in CI.
npm run db:ensure

echo "==> Building"
npm run build

echo "==> Restarting PM2 ($PM2_NAME)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 delete "$PM2_NAME"
fi
pm2 start .output/server/index.mjs --name "$PM2_NAME"
pm2 save

pm2 status "$PM2_NAME"
echo "==> Deploy complete"
