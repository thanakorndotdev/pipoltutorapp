#!/usr/bin/env sh
# Safe update on the production server: refuse while students are mid-exam,
# back up the database and uploads, pull, build while the old version keeps
# serving, switch over, then wait for /health.
#
#   sh docker/deploy.sh                 # normal update
#   FORCE=1 sh docker/deploy.sh         # update even with exams in progress
#   BACKUP_DIR=/srv/backups sh docker/deploy.sh
#
# Never touches the postgres_data / uploads_data volumes.
set -eu

cd "$(dirname "$0")/.."
DC="docker compose -f docker/docker-compose.yml"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n==> %s\n' "$1"; }

say "1/6 Checking for exams in progress"
LIVE=$($DC exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from attempts where status = '"'"'in_progress'"'"' and expires_at > now()"')
echo "students mid-exam: $LIVE"
if [ "$LIVE" != "0" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Stopped: wait until they finish, or rerun with FORCE=1 (their saved answers are kept, but the page stalls for about 30 seconds)."
  exit 1
fi

say "2/6 Backing up database and uploads to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
$DC exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_DIR/db-$STAMP.dump"
$DC exec -T backend tar czf - -C /app/uploads . > "$BACKUP_DIR/uploads-$STAMP.tgz"
if [ ! -s "$BACKUP_DIR/db-$STAMP.dump" ]; then
  echo "Stopped: database backup is empty."
  exit 1
fi
PREV=$(git rev-parse --short HEAD)
echo "$PREV" > "$BACKUP_DIR/version-before-$STAMP.txt"
ls -lh "$BACKUP_DIR/db-$STAMP.dump" "$BACKUP_DIR/uploads-$STAMP.tgz"

say "3/6 Pulling the new version (current: $PREV)"
git pull --ff-only
NEXT=$(git rev-parse --short HEAD)
if [ "$PREV" = "$NEXT" ]; then
  echo "Already up to date; rebuilding anyway."
fi

say "4/6 Building (the old version keeps serving meanwhile)"
$DC build

say "5/6 Switching to $NEXT"
$DC up -d

say "6/6 Waiting for the backend to report healthy"
i=0
until $DC exec -T backend wget -qO- http://localhost:3001/health 2>/dev/null | grep -q '"db":"up"'; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "Backend not healthy after 60 seconds. Check: $DC logs --tail 100 backend"
    echo "Roll back code: git checkout $PREV && $DC up -d --build"
    echo "Database backup: $BACKUP_DIR/db-$STAMP.dump"
    exit 1
  fi
  sleep 2
done

echo
echo "Done: $PREV -> $NEXT. Backup: $BACKUP_DIR/db-$STAMP.dump"
