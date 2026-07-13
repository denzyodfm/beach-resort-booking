# Scheduled Supabase Backups

This app uses Supabase, so the scheduled database backup should run from the VPS with a direct Postgres connection string. Do not commit the connection string to Git.

## 1. Install pg_dump on the VPS

```bash
sudo apt update
sudo apt install postgresql-client
```

## 2. Create a private backup env file

Create `/var/www/beach-resort-booking/.env.backup` on the VPS:

```bash
sudo nano /var/www/beach-resort-booking/.env.backup
```

Add your Supabase direct database URL:

```env
SUPABASE_DB_URL="postgresql://postgres.PROJECT_REF:YOUR_DB_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"
BACKUP_DIR="/var/backups/bolihon/supabase"
RETENTION_DAYS="14"
APP_NAME="bolihon"
```

You can get the connection string from Supabase Dashboard:

`Project Settings -> Database -> Connection string`

Use the session pooler or direct connection string, then replace the password placeholder with your database password.

Lock down the env file:

```bash
sudo chown costapalma:costapalma /var/www/beach-resort-booking/.env.backup
chmod 600 /var/www/beach-resort-booking/.env.backup
```

## 3. Test a backup manually

```bash
cd /var/www/beach-resort-booking
chmod +x scripts/backup-supabase.sh
./scripts/backup-supabase.sh
ls -lh /var/backups/bolihon/supabase
```

## 4. Schedule the backup

Open the crontab:

```bash
crontab -e
```

Run a backup every day at 2:15 AM:

```cron
15 2 * * * cd /var/www/beach-resort-booking && /usr/bin/env bash scripts/backup-supabase.sh >> /var/log/bolihon-backup.log 2>&1
```

## 5. Restore from a backup

Be careful: this can overwrite database objects.

```bash
gunzip -c /var/backups/bolihon/supabase/bolihon_supabase_YYYYMMDDTHHMMSSZ.sql.gz | psql "$SUPABASE_DB_URL"
```

## Notes

- This backs up the Supabase Postgres database only.
- Supabase Storage files, such as uploaded payment proofs, need a separate storage export if you use Supabase Storage for them.
- Keep at least one backup copy outside the VPS if this becomes production-critical.
