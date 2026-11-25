#!/usr/bin/env bash
# Check whether portal pages can be embedded (no X-Frame-Options, CSP frame-ancestors present).
# Usage: bash scripts/verify-portal-iframe-headers.sh https://track.cravingcodetech.in your-portal-slug
set -euo pipefail

BASE="${1:-https://track.cravingcodetech.in}"
SLUG="${2:-demo}"
URL="${BASE%/}/portal/${SLUG}/dashboard?embed=1"

echo "==> HEAD $URL"
HEADERS="$(curl -sSI "$URL" || true)"

echo "$HEADERS" | sed -n '1,20p'

if echo "$HEADERS" | grep -qi '^x-frame-options:'; then
  echo ""
  echo "FAIL: X-Frame-Options is set — browsers will block cross-origin iframes."
  echo "Fix nginx on the VPS (see scripts/nginx-portal-iframe.conf.example) and disable"
  echo "Hostinger 'Security headers' that add X-Frame-Options: SAMEORIGIN."
  exit 1
fi

if ! echo "$HEADERS" | grep -qi 'content-security-policy:.*frame-ancestors'; then
  echo ""
  echo "WARN: No CSP frame-ancestors header — embedding may fail on some browsers."
  exit 1
fi

echo ""
echo "OK: Portal response looks iframe-friendly."
