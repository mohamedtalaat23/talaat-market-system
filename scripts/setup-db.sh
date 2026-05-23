#!/usr/bin/env bash
# ============================================================
# setup-db.sh — Create PostgreSQL database and user
#
# Run this ONCE on a fresh system to set up the database.
# Requires: PostgreSQL is installed and running.
#
# Usage:
#   chmod +x scripts/setup-db.sh
#   ./scripts/setup-db.sh
# ============================================================

set -euo pipefail

# ── Load .env if it exists ────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

# ── Configuration (with defaults matching .env.example) ──────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-talaat_market}"
DB_USER="${DB_USER:-talaat_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}ℹ️  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }

# ── Check prerequisites ───────────────────────────────────────
echo ""
echo "============================================================"
echo "  Talaat Market — Database Setup"
echo "============================================================"
echo ""

# Check psql is available
if ! command -v psql &>/dev/null; then
  error "psql not found. Please install PostgreSQL first.
  Ubuntu/Debian:  sudo apt-get install postgresql postgresql-client
  Fedora/RHEL:    sudo dnf install postgresql postgresql-server
  Windows:        Download from https://www.postgresql.org/download/windows/"
fi

info "PostgreSQL client found: $(psql --version)"

# Check password is set
if [[ -z "${DB_PASSWORD}" ]]; then
  warn "DB_PASSWORD is not set in .env. You will be prompted for the new user password."
  read -s -r -p "Enter password for database user '${DB_USER}': " DB_PASSWORD
  echo ""
  if [[ -z "${DB_PASSWORD}" ]]; then
    error "Password cannot be empty."
  fi
fi

# ── Create user and database ──────────────────────────────────
info "Creating database user: ${DB_USER}"

# Create user (ignore error if already exists)
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null \
  || warn "User '${DB_USER}' may already exist — skipping user creation"

info "Creating database: ${DB_NAME}"

# Create database (ignore error if already exists)
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';" 2>/dev/null \
  || warn "Database '${DB_NAME}' may already exist — skipping database creation"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null
sudo -u postgres psql -c "\c ${DB_NAME}; GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null

# Enable pg_trgm extension for fuzzy product name search
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null \
  || warn "Could not create pg_trgm extension (may need superuser)"

success "Database setup complete!"
echo ""
echo "  Database: ${DB_NAME}"
echo "  User:     ${DB_USER}"
echo "  Host:     ${DB_HOST}:${DB_PORT}"
echo ""
echo "  Next steps:"
echo "  1. Copy .env.example to .env and fill in your values"
echo "  2. Run migrations: npm run migrate --workspace=packages/server"
echo "  3. Start dev server: npm run dev"
echo ""
