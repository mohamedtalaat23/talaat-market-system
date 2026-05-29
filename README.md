# 🏪 Talaat Market System

> نظام إدارة السوبر ماركت — A production-grade supermarket management system designed for family-run retail stores in Egypt.

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-v32-blue)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-v18-61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.6-3178C6)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v14+-336791)](https://postgresql.org)

---

## Overview

Talaat Market is a fully offline, high-performance retail POS and ERP system engineered specifically for family supermarkets. Designed for intense daily retail work, it combines keyboard-first speed and native hardware interfaces with robust PostgreSQL database transactions and strict administrative audits.

**Architecture Philosophy:** 
- **Local-First & Offline Resilient**: Runs entirely on localhost or a local LAN, protecting operations against internet drops.
- **Decoupled Workspaces**: Utilizes `npm Workspaces` to separate the React client, Express API server, and Electron native desktop shell.

---

## Core Features

- **🛒 Keyboard-First POS Checkout**: Under 1.5-second checkout transactions. Monitors physical USB barcode scanners using capture-phase keyboard timings (<30ms burst detection) to read barcodes even if fields are unfocused.
- **👥 Customer Credit Profiles**: Signed accounts balances tracking credit debt (negative balance) and deposits (positive store credit), with chronological double-entry transaction histories and F7 customer selections.
- **🔑 PIN Override Protections**: Restricted areas and cashier locks. Delicate POS activities (discounts, reprints, voids) trigger a prompt requesting a Manager's 4-digit bcrypt-hashed PIN.
- **🖨️ Silent Thermal Receipt Printing**: Generates 80mm receipts utilizing Electron's native print API or an iframe fallback, featuring a reprint audit counter to prevent cashier fraud.
- **📊 Financial Analytics & Reports**: Multi-screen `/reports` dashboard tracking closed cashier shifts (starting cash vs ending cash variance), override audits, and printable weekly sales metrics.
- **⚙️ Store Configuration & Registers**: Global control of currency, tax rates, thermal printer templates, and physical registers to lay the groundwork for a LAN multi-terminal model.
- 🔋 **Idempotent Checkout**: Client-side transaction UUID keys protect database actions against double-billing and inventory duplicates.
- 📦 **Purchase Orders & AVCO Costing**: Logistics control from draft POs to manager placement and physical receipt. Dynamically recalculates product cost price using the Weighted Average Cost (AVCO) formula on stock receipt.

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
git clone git@github.com:mohamedtalaat23/talaat-market-system.git
cd "Talaat Market System"
```

### 2. Install dependencies

```bash
npm install
```

This installs dependencies for all three packages (`client`, `server`, `desktop`) in one command via npm workspaces.

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
JWT_SECRET=your_jwt_signing_token_secret
```

Generate a secure session/JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Set up the database

```bash
# Creates the PostgreSQL user and database
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

> **Windows users:** Create the user and database manually using `psql` or pgAdmin — see [Windows setup](#windows-setup).

### 5. Run database migrations

```bash
npm run migrate --workspace=packages/server
```

### 6. Start development

```bash
npm run dev
```

This starts all three packages concurrently:
- 🟢 **Server** — Express API on `http://localhost:3001`
- 🔵 **Client** — Vite React dev server on `http://localhost:5173`
- 🟡 **Electron** — Desktop shell (waits for server + client to be ready)

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
│   │   │   ├── App.tsx           # Router + query client
│   │   │   ├── components/       # Common Layout (AppLayout) & UI Kits
│   │   │   ├── features/         # Feature domains (POS, inventory, customers)
│   │   │   ├── services/         # Axios API client wrapper
│   │   │   ├── stores/           # Zustand stores (usePOSStore, authStore)
│   │   │   └── styles/           # Vanilla CSS + Tailwind theme setup
│   │
│   ├── server/                   # Express.js API
│   │   ├── src/
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── config/           # Database configurations & env validations
│   │   │   ├── middleware/       # RBAC & unified error-boundary mapping
│   │   │   ├── routes/           # Routing groups namespaced under /api/v1
│   │   │   ├── controllers/      # Request handlers (Zod parsing)
│   │   │   └── repositories/     # Data layers (raw Knex SQL operations)
│   │   └── migrations/           # Knex SQL Schema migration history
│   │
│   └── desktop/                  # Electron desktop wrapper
│       ├── src/
│       │   ├── main.ts           # Electron main process (lifecycle & server spawn)
│       │   ├── preload.ts        # IPC bridge (contextBridge)
│       │   └── server-manager.ts # ESM-compliant background server launcher
│
└── scripts/
    └── setup-db.sh               # Database creation script
```

---

## Available Commands

### Development

```bash
# Start everything concurrently
npm run dev

# Start individual packages
npm run dev:server    # Express API only
npm run dev:client    # Vite dev server only
npm run dev:desktop   # Electron only (requires server + client running)
```

### Code Quality & Validation

```bash
# TypeScript type checking
npm run typecheck

# Lint files
npm run lint

# Format codebase
npm run format
```

### Building & Packaging

```bash
# Build all packages for production
npm run build

# Package Electron app
npm run package --workspace=packages/desktop
```

---

## System Architecture

```
Electron (Main Process)
    ├── Spawns Express.js background server
    ├── Creates secure sandboxed window
    └── Intercepts Electron IPC channels (printing, OS metrics)

React Client (Renderer)
    ├── Communicates with Express via HTTP REST
    ├── State: Zustand (Local Persistent Cart) + TanStack Query (Server Cache)
    └── Binds global hotkeys:
          - F1 / Space : Checkout Pay
          - F3 : Cart Discounts
          - F4 : Cart Hold / Resume
          - F5 : Product Catalog Lookup
          - F6 : Receipt Transaction Search
          - F7 : Link Customer Account
          - F8 : Void Transaction
          - F12: Exit POS (Manager only)

Express.js Server
    ├── REST API on localhost:3001
    ├── Session authentication and Stateless JWT RBAC
    └── Zod validator parameters

PostgreSQL
    └── Double-entry ledger tables & checks (inventory.quantity >= 0)
```

---

## PostgreSQL Installation

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-client

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Run setup script
./scripts/setup-db.sh
```

### Fedora / RHEL

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
3. Add PostgreSQL `bin` directory to your System PATH:
   `C:\Program Files\PostgreSQL\<version>\bin`
4. Open PowerShell as Administrator:
   ```powershell
   psql -U postgres -c "CREATE USER talaat_user WITH PASSWORD 'your_password';"
   psql -U postgres -c "CREATE DATABASE talaat_market OWNER talaat_user;"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE talaat_market TO talaat_user;"
   ```

---

## Development Phases & Status

| Phase | Feature Description | Status |
|-------|---------------------|--------|
| **Phase 1** | Project scaffolding, DB migration schema, & basic layouts | ✅ Complete |
| **Phase 2** | Keyboard-driven POS checkout, barcode scan parser, Zustand cart | ✅ Complete |
| **Phase 3** | Suspended carts (Hold/Resume) and persistent local storage | ✅ Complete |
| **Phase 4** | Manager override locks and cash calculators | ✅ Complete |
| **Phase 5** | Cashier enclosures, lock-in routing rules | ✅ Complete |
| **Phase 6** | Silent 80mm receipt printing and secure shift audits | ✅ Complete |
| **Phase 7** | Real-Time Inventory & Adjustment Logs | ✅ Complete |
| **Phase 8** | Shift variance reconciliation and weekly profit reports | ✅ Complete |
| **Phase 9** | Global Settings dashboard & Registers management for LAN | ✅ Complete |
| **Phase 10**| Customer Credit accounts, ledger auditing, POS F7 link | ✅ Complete |
| **Phase 11**| Suppliers Directory & Catalog Management | ✅ Complete |
| **Phase 12**| Native USB ESC/POS direct printing (bypassing OS drivers) | ✅ Complete |
| **Phase 13**| Multi-terminal LAN synchronization (Outage buffers) | ✅ Complete |
| **Phase 14**| Purchase Orders & Supplier Stock Influx | ✅ Complete |

---

## License

Proprietary — Talaat Market, 2026. All rights reserved.
