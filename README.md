# 🏪 Talaat Market System

> نظام إدارة السوبر ماركت — A production-grade supermarket management system

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-v32-blue)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-v18-61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.6-3178C6)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v14+-336791)](https://postgresql.org)

---

## Overview

Talaat Market is a fully offline, locally-run supermarket management system designed for small family supermarkets. Built for daily use with speed, reliability, and simplicity as core priorities.

**Stack:** Electron · React · Express.js · PostgreSQL · TypeScript

---

## Prerequisites

Before setting up the project, ensure you have:

| Software | Version | Install |
|----------|---------|---------|
| **Node.js** | ≥ 20.0.0 | [nodejs.org](https://nodejs.org) or `nvm install --lts` |
| **npm** | ≥ 10.0.0 | Included with Node.js |
| **PostgreSQL** | ≥ 14 | See [PostgreSQL install guide](#postgresql-installation) |
| **Git** | Any | [git-scm.com](https://git-scm.com) |

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd "talaat-market"
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for all three packages (client, server, desktop) via npm workspaces.

### 3. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your database credentials and session secret.

**Required values:**
```env
DB_NAME=talaat_market
DB_USER=talaat_user
DB_PASSWORD=your_secure_password
SESSION_SECRET=a_very_long_random_string_at_least_32_chars
```

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Set up the database

```bash
# Creates the PostgreSQL user and database
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

> **Windows users:** Use PowerShell with psql directly — see [Windows setup](#windows-setup).

### 5. Run database migrations

```bash
npm run migrate --workspace=packages/server
```

### 6. Start development

```bash
npm run dev
```

This starts all three services concurrently:
- 🟢 **Server** — Express API on `http://localhost:3001`
- 🔵 **Client** — Vite dev server on `http://localhost:5173`
- 🟡 **Electron** — Desktop window (waits for server + client to be ready)

---

## Project Structure

```
talaat-market/
├── package.json                  # Root workspace configuration
├── tsconfig.base.json            # Shared TypeScript configuration
├── eslint.config.js              # ESLint flat config (v9)
├── .prettierrc                   # Prettier formatting config
├── .env.example                  # Environment variable template
│
├── packages/
│   ├── client/                   # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx          # React entry point
│   │   │   ├── App.tsx           # Router + providers
│   │   │   ├── components/
│   │   │   │   ├── layout/       # AppLayout, sidebar, header
│   │   │   │   └── ui/           # Reusable UI components
│   │   │   ├── features/         # Feature modules (POS, inventory, etc.)
│   │   │   ├── services/         # API client (Axios)
│   │   │   ├── stores/           # Zustand stores (global state)
│   │   │   ├── styles/           # CSS design system
│   │   │   └── types/            # TypeScript types
│   │   ├── vite.config.ts        # Vite bundler configuration
│   │   └── index.html            # HTML entry point
│   │
│   ├── server/                   # Express.js API
│   │   ├── src/
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── app.ts            # Express app factory
│   │   │   ├── config/           # env, database, constants
│   │   │   ├── middleware/       # logger, errorHandler
│   │   │   ├── routes/           # Route definitions
│   │   │   ├── controllers/      # Request handlers (thin)
│   │   │   ├── services/         # Business logic
│   │   │   └── repositories/     # Database queries (Knex)
│   │   └── migrations/           # Knex database migrations
│   │
│   └── desktop/                  # Electron shell
│       ├── src/
│       │   ├── main.ts           # Electron main process
│       │   ├── preload.ts        # IPC bridge (contextBridge)
│       │   ├── server-manager.ts # Express fork manager
│       │   └── ipc/              # IPC channels + handlers
│       ├── resources/            # App icons
│       └── electron-builder.yml  # Packaging configuration
│
└── scripts/
    └── setup-db.sh               # Database creation script
```

---

## Available Commands

### Development

```bash
# Start everything (recommended)
npm run dev

# Start individual services
npm run dev:server    # Express API only
npm run dev:client    # Vite dev server only
npm run dev:desktop   # Electron only (requires server + client running)
```

### Code Quality

```bash
# TypeScript type checking
npm run typecheck

# ESLint
npm run lint
npm run lint:fix

# Prettier formatting
npm run format
npm run format:check
```

### Building

```bash
# Build all packages for production
npm run build

# Build individual packages
npm run build:server
npm run build:client
npm run build:desktop
```

### Database

```bash
# Run pending migrations
npm run migrate --workspace=packages/server

# Roll back last migration
npm run migrate:rollback --workspace=packages/server
```

---

## Architecture

### System Overview

```
Electron (Main Process)
    ├── Forks Express.js server (production)
    ├── Creates BrowserWindow → loads React app
    └── IPC bridge via preload.ts

React (Renderer)
    ├── Communicates with Express via HTTP REST
    ├── State: Zustand (UI) + TanStack Query (server data)
    └── Hardware access via window.electronAPI (IPC)

Express.js
    ├── REST API on localhost:PORT
    ├── Knex.js → PostgreSQL
    └── Session management

PostgreSQL (Local)
    └── All business data
```

### Data Flow

```
User Action → React Component
           → Zustand (local state) or TanStack Query mutation
           → Axios → Express API (localhost)
           → Zod validation → Controller → Service → Repository
           → Knex → PostgreSQL
           ← Response → Update UI
```

### Security Model

- `contextIsolation: true` — renderer cannot access Node.js globals
- `nodeIntegration: false` — no Node APIs in the browser context
- `contextBridge` — narrow, typed API exposed to renderer
- Session-based auth (Phase 3) — no JWT complexity
- Zod validation on all API inputs
- bcrypt for password/PIN hashing

---

## PostgreSQL Installation

### Ubuntu / Debian

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-client

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Run setup script
./scripts/setup-db.sh
```

### Fedora / RHEL / CentOS

```bash
sudo dnf install postgresql postgresql-server
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql

./scripts/setup-db.sh
```

### Windows Setup

1. Download PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer (remember your `postgres` superuser password)
3. Add PostgreSQL `bin` directory to your PATH:
   ```
   C:\Program Files\PostgreSQL\16\bin
   ```
4. Open PowerShell as Administrator:
   ```powershell
   psql -U postgres -c "CREATE USER talaat_user WITH PASSWORD 'your_password';"
   psql -U postgres -c "CREATE DATABASE talaat_market OWNER talaat_user;"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE talaat_market TO talaat_user;"
   ```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment: development \| production \| test |
| `SERVER_PORT` | No | `3001` | Express API port |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | **Yes** | — | Database name |
| `DB_USER` | **Yes** | — | Database user |
| `DB_PASSWORD` | **Yes** | — | Database password |
| `SESSION_SECRET` | **Yes** | — | Session encryption secret (min 32 chars) |
| `LOG_LEVEL` | No | `info` | Log level: error \| warn \| info \| debug |
| `BACKUP_DIR` | No | `~/TalaatMarket/backups` | Backup storage directory |

---

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Foundation (monorepo, scaffold, DB connection) | ✅ **Current** |
| **Phase 2** | POS system (barcode scanning, cart, payment) | 🔲 Planned |
| **Phase 3** | Inventory & Suppliers (stock, purchase orders) | 🔲 Planned |
| **Phase 4** | Reports & Dashboard (KPIs, charts) | 🔲 Planned |
| **Phase 5** | Polish (customers, employees, settings, backup) | 🔲 Planned |
| **Phase 6** | Hardware (receipt printer, cash drawer) + packaging | 🔲 Planned |
| **Phase 7** | LAN multi-terminal, Arabic UI, loyalty points | 🔲 Future |

---

## Contributing & Coding Conventions

- **TypeScript strict mode** everywhere — no `any`, no `!` non-null assertions
- **Feature folders**: each domain (POS, inventory, etc.) is self-contained under `features/`
- **Naming**: PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants
- **Database**: All SQL in Repository classes, business logic in Services, no SQL in Controllers
- **Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` prefixes
- **No magic numbers**: All constants defined in `constants.ts`

---

## API Documentation

Base URL (development): `http://localhost:3001/api/v1`

### Currently Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health` | Server health check with DB status |

### Planned (Phase 2+)

See [`docs/api.md`](docs/api.md) for the full planned API specification.

---

## License

Proprietary — Talaat Market, 2026. All rights reserved.
