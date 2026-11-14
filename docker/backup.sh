#!/bin/sh
set -eu
umask 077
: "${BACKUP_AGE_RECIPIENT:?Owner age public recipient is required}"
backup_once() {
  task_tmp=$(mktemp -d)
  trap 'rm -rf "$task_tmp"' EXIT INT TERM
  mkdir "$task_tmp/payload"
  task_stamp=$(date -u +%Y%m%dT%H%M%SZ)
  pg_dump --format=custom --file="$task_tmp/payload/database.dump"
  # Physical base backup plus continuously archived WAL enable point-in-time recovery.
  pg_basebackup --pgdata="$task_tmp/payload/base" --wal-method=stream --checkpoint=fast
  cp -R /assets "$task_tmp/payload/assets"
  cp -R /wal-archive "$task_tmp/payload/wal-archive"
  printf '%s\n' "$task_stamp" > "$task_tmp/payload/backup-time-utc.txt"
  tar -czf "$task_tmp/archive.tar.gz" -C "$task_tmp/payload" .
  age -r "$BACKUP_AGE_RECIPIENT" -o "/backups/$task_stamp.tar.gz.age.part" "$task_tmp/archive.tar.gz"
  mv "/backups/$task_stamp.tar.gz.age.part" "/backups/$task_stamp.tar.gz.age"
  sha256sum "/backups/$task_stamp.tar.gz.age" > "/backups/$task_stamp.sha256"
  rm -rf "$task_tmp"
  trap - EXIT INT TERM
  printf '%s\n' "Encrypted DB/base/WAL/assets backup completed: $task_stamp"
}
while :; do
  backup_once
  if [ "${BACKUP_ONCE:-0}" = 1 ]; then break; fi
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
