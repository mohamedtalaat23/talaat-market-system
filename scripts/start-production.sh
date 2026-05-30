#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
ENV_FILE="$ROOT_DIR/.env.production"
FALLBACK_ENV_FILE="$ROOT_DIR/.env"

# Use .env.production if it exists, otherwise fall back to .env
ACTIVE_ENV_FILE="$ENV_FILE"
if [ ! -f "$ACTIVE_ENV_FILE" ] && [ -f "$FALLBACK_ENV_FILE" ]; then
  ACTIVE_ENV_FILE="$FALLBACK_ENV_FILE"
fi

if [ -f "$ACTIVE_ENV_FILE" ]; then
  # ── Credentials Safeguard ────────────────────────────────────────────────
  if grep -q "talaat_dev_password" "$ACTIVE_ENV_FILE" || \
     grep -q "dev_session_secret_change_this_in_production_minimum_32_chars_required" "$ACTIVE_ENV_FILE" || \
     grep -q "dev_jwt_secret_change_this_in_production_minimum_32_chars_required" "$ACTIVE_ENV_FILE"; then
    echo "❌ SECURITY ERROR: Default development credentials detected in environment file!"
    echo "   Please replace the placeholder values (DB_PASSWORD, SESSION_SECRET, JWT_SECRET)"
    echo "   with high-entropy secure values before deploying."
    exit 1
  fi

  export $(grep -v '^#' "$ACTIVE_ENV_FILE" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

until timeout 1 bash -c "cat < /dev/null > /dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; do
  sleep 2
done

cd "$ROOT_DIR"
npm run db:migrate

sudo systemctl daemon-reload
sudo systemctl enable talaat-pos.service
sudo systemctl restart talaat-pos.service
