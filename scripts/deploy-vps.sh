#!/usr/bin/env bash
# Deploys the latest GitHub main on the VPS and rolls back automatically if anything fails.
#
# Run from the development PC (asks for the VPS password once):
#   ssh <user>@172.16.0.159 "bash -s" < scripts/deploy-vps.sh
# Roll back to the version before the last deploy:
#   ssh <user>@172.16.0.159 "bash -s -- rollback" < scripts/deploy-vps.sh
#
# Settings (override as env vars before "bash -s" if yours differ):
#   APP_DIR=/var/www/beach-resort-booking  PM2_NAME=bolihon  HEALTH_URL=http://127.0.0.1:3000/
set -uo pipefail

APP_DIR="${APP_DIR:-/var/www/beach-resort-booking}"
PM2_NAME="${PM2_NAME:-bolihon}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/}"
HISTORY_FILE=".deploy-history"

cd "$APP_DIR" || { echo "!! $APP_DIR not found"; exit 1; }

restart_app() {
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env
  else
    pm2 start npm --name "$PM2_NAME" -- start
  fi
  pm2 save >/dev/null
}

healthy() {
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" || true)
    case "$code" in 2??|3??) echo "== Health check OK ($code) at $HEALTH_URL"; return 0 ;; esac
    sleep 2
  done
  echo "!! Health check failed at $HEALTH_URL (last status: ${code:-none})"
  return 1
}

# Puts the code and the build back to commit $1 and restarts the app.
restore() {
  local target="$1"
  echo "== Rolling back to $target"
  git reset --hard "$target"
  npm ci --no-audit --no-fund
  if [ -d .next.rollback ]; then
    rm -rf .next && mv .next.rollback .next
  else
    npm run build
  fi
  restart_app
  healthy && echo "== Rolled back to $(git log --oneline -1)"
}

if [ "${1:-}" = "rollback" ]; then
  target=$(tail -n 1 "$HISTORY_FILE" 2>/dev/null)
  [ -n "$target" ] || { echo "!! No previous deploy recorded in $HISTORY_FILE"; exit 1; }
  restore "$target"
  sed -i '$d' "$HISTORY_FILE"
  exit 0
fi

previous=$(git rev-parse HEAD)
echo "== Current version: $(git log --oneline -1)"

# Keep the working build so a failed deploy can be restored without rebuilding.
rm -rf .next.rollback
[ -d .next ] && cp -a .next .next.rollback

fail() {
  echo "!! Deploy failed: $1"
  restore "$previous"
  exit 1
}

git pull --ff-only origin main || fail "git pull (local changes on the VPS?)"
if [ "$(git rev-parse HEAD)" = "$previous" ]; then
  echo "== Already up to date; nothing to deploy."
  rm -rf .next.rollback
  exit 0
fi
echo "== Deploying: $(git log --oneline -1)"

npm ci --no-audit --no-fund || fail "npm ci"
npm run build || fail "npm run build"
restart_app || fail "pm2 restart"
healthy || fail "app did not come up"

echo "$previous" >> "$HISTORY_FILE"
echo "== Deployed $(git log --oneline -1). Previous build kept for rollback."
