#!/usr/bin/env bash
# Run on the VPS from the app directory after git pull.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buildesk}"
cd "$APP_DIR"

echo "==> Node $(node -v) | npm $(npm -v)"

# Full install: vite / nitro / drizzle-kit / tsx live in devDependencies.
echo "==> Installing dependencies"
npm ci

echo "==> Applying DB schema"
# drizzle-kit push can fail on SQLite ADD COLUMN; ensure script patches missing cols safely.
if ! npx drizzle-kit push; then
  echo "==> drizzle-kit push failed — applying column patches via db:ensure"
fi
npm run db:ensure

echo "==> Building"
npm run build

echo "==> Restarting PM2"
if pm2 describe buildesk >/dev/null 2>&1; then
  pm2 restart buildesk --update-env
else
  pm2 start .output/server/index.mjs --name buildesk
  pm2 save
fi

pm2 status buildesk
echo "==> Deploy complete"
