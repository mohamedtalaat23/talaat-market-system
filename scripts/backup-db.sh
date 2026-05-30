#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-talaat_market}"
DB_USER="${DB_USER:-talaat_user}"
DB_PASSWORD="${DB_PASSWORD:-talaat_dev_password}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/TalaatMarket/backups}"
BACKUP_DIR="${BACKUP_DIR/#\~/$HOME}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${TIMESTAMP}.dump"

LOG_DIR="/var/log/talaat-market"
LOG_FILE="$LOG_DIR/backup.log"

if [ ! -d "$LOG_DIR" ]; then
  mkdir -p "$LOG_DIR" 2>/dev/null
  if [ $? -ne 0 ]; then
    LOG_FILE="$SCRIPT_DIR/../logs/backup.log"
    mkdir -p "$(dirname "$LOG_FILE")"
  fi
fi

export PGPASSWORD="$DB_PASSWORD"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_FILE" "$DB_NAME" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: Backup created at $BACKUP_FILE" >> "$LOG_FILE"
  find "$BACKUP_DIR" -type f -name "*.dump" -mtime +30 -exec rm -f {} \;
  exit 0
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] FAILURE: Backup failed for database $DB_NAME" >> "$LOG_FILE"
  rm -f "$BACKUP_FILE"
  exit 1
fi
