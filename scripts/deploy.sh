#!/usr/bin/env bash
# Run on the VPS from the app directory after git pull.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/buildesk}"
cd "$APP_DIR"

echo "==> Node $(node -v) | npm $(npm -v)"

# Full install: vite / nitro / drizzle-kit live in devDependencies and are required to build + push schema.
echo "==> Installing dependencies"
npm ci

echo "==> Applying DB schema (safe; does not reseed)"
npx drizzle-kit push

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
