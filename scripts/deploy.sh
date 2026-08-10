#!/usr/bin/env bash
# Run on the VPS from the app directory after git pull.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/home/buildesk-track/htdocs/track.cravingcodetech.in}"
PM2_NAME="${PM2_NAME:-buildesk-compass}"
cd "$APP_DIR"

# Prefer user-level Node 22 (nvm / fnm) — package engines require 22.x
if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || nvm install 22
elif command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 >/dev/null 2>&1 || fnm install 22
fi

NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
echo "==> Node $(node -v) | npm $(npm -v)"
echo "==> APP_DIR=$APP_DIR PM2_NAME=$PM2_NAME"

if [[ "$NODE_MAJOR" != "22" ]]; then
  echo "ERROR: Node 22.x is required (got $(node -v))."
  echo "Install for this user (no sudo):"
  echo '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash'
  echo '  source ~/.nvm/nvm.sh && nvm install 22 && nvm alias default 22'
  exit 1
fi

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

# Full install: vite / nitro / drizzle-kit live in devDependencies.
# NODE_ENV=production in .env would otherwise skip them — force include.
echo "==> Installing dependencies (including devDependencies for build)"
npm ci --include=dev

echo "==> Applying DB schema patches (safe / non-interactive)"
# Prefer db:ensure over drizzle-kit push — push can prompt for destructive drops in CI.
npm run db:ensure

echo "==> Building"
npm run build

echo "==> Restarting PM2 ($PM2_NAME)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 delete "$PM2_NAME"
fi
# Capture current env (from .env) into the PM2 process
pm2 start .output/server/index.mjs --name "$PM2_NAME"
pm2 save

pm2 status "$PM2_NAME"
echo "==> Deploy complete"
