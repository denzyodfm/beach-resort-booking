#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-bolihon}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/$APP_NAME/supabase}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${ENV_FILE:-/var/www/beach-resort-booking/.env.backup}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Missing SUPABASE_DB_URL. Add it to $ENV_FILE or export it before running this script." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required. Install it with: sudo apt install postgresql-client" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
backup_file="$BACKUP_DIR/${APP_NAME}_supabase_${timestamp}.sql.gz"

pg_dump \
  --dbname="$SUPABASE_DB_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip -9 > "$backup_file"

chmod 600 "$backup_file"
find "$BACKUP_DIR" -type f -name "${APP_NAME}_supabase_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backup saved to $backup_file"
