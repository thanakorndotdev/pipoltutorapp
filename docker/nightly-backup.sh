#!/usr/bin/env sh
# Nightly local backup on the production server: database, uploaded images,
# issued certificate files and the private certificate signing keys, then
# delete sets older than KEEP_DAYS. Same files as step 2 of deploy.sh.
#
#   sh docker/nightly-backup.sh
#   BACKUP_DIR=/srv/backups KEEP_DAYS=30 sh docker/nightly-backup.sh
#
# crontab -e (03:00 every night):
#   0 3 * * * sh /opt/pipoltutorapp/docker/nightly-backup.sh >> /opt/backups/nightly.log 2>&1
#
# Copies stay on this server; copy them off it as well (see the deploy guide).
set -eu
# Backups hold student data and private keys: owner-only.
umask 077

cd "$(dirname "$0")/.."
DC="docker compose -f docker/docker-compose.yml"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

$DC exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_DIR/db-$STAMP.dump"
if [ ! -s "$BACKUP_DIR/db-$STAMP.dump" ]; then
  echo "$STAMP backup FAILED: database dump is empty" >&2
  exit 1
fi
$DC exec -T backend tar czf - -C /app/uploads . > "$BACKUP_DIR/uploads-$STAMP.tgz"
for d in certificates cert-keys; do
  if $DC exec -T backend test -d "/app/$d"; then
    $DC exec -T backend tar czf - -C "/app/$d" . > "$BACKUP_DIR/$d-$STAMP.tgz"
  fi
done

# Rotate: only our own file patterns, only inside BACKUP_DIR.
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*.dump' -o -name 'uploads-*.tgz' -o -name 'certificates-*.tgz' -o -name 'cert-keys-*.tgz' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "$STAMP backup ok: $(ls -1 "$BACKUP_DIR" | grep -c "$STAMP") files in $BACKUP_DIR"
