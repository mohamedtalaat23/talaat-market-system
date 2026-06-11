# 🏪 Talaat Market System

> نظام إدارة السوبر ماركت — A production-grade supermarket management system designed for family-run retail stores in Egypt.

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/Electron-v32-blue)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-v18-61DAFB)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.6-3178C6)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v14+-336791)](https://postgresql.org)

---

## Table of Contents
1. [Overview & Philosophy](#overview--philosophy)
2. [Core Features](#core-features)
3. [Financial Integrity & Reversals](#financial-integrity--reversals)
4. [Security & Auditability](#security--auditability)
5. [Keyboard Shortcuts Map](#keyboard-shortcuts-map)
6. [Quick Start](#quick-start)
7. [Packaged Windows App](#packaged-windows-app)
8. [System Architecture](#system-architecture)
9. [Project Structure](#project-structure)
10. [Available Commands](#available-commands)
11. [PostgreSQL Installation](#postgresql-installation)
12. [License](#license)

---

## Overview & Philosophy

Talaat Market is a fully offline, high-performance retail POS and ERP system engineered specifically for family supermarkets. Designed for intense daily retail work, it combines keyboard-first speed and native hardware interfaces with robust PostgreSQL database transactions and strict administrative audits.

**Architecture Philosophy:** 
- **Financial Integrity First**: Mathematically sound reconciliation ledgers that track physical cash variances immutably.
- **Local-First & Offline Resilient**: Runs entirely on localhost or a local LAN, protecting operations against internet drops.
- **Decoupled Workspaces**: Utilizes `npm Workspaces` to separate the React client, Express API server, and Electron native desktop shell.

---

## Core Features

- **🛒 Keyboard-First POS Checkout**: Under 1.5-second checkout transactions. Monitors physical USB barcode scanners using capture-phase keyboard timings (<30ms burst detection) to read barcodes even if fields are unfocused.
- **👥 Customer Credit Profiles**: Signed accounts balances tracking credit debt (negative balance) and deposits (positive store credit), with chronological double-entry transaction histories.
- **🖨️ Silent Thermal Receipt Printing**: Generates 80mm receipts utilizing Electron's native print API or an iframe fallback.
- **📊 Reports & Shifts**: Multi-screen `/reports` dashboard tracking closed cashier shifts (starting cash vs ending cash variance).
- **⚙️ Store Configuration**: Global control of currency, tax rates, thermal printer templates, and physical registers.
- 📦 **Purchase Orders & AVCO Costing**: Logistics control from draft POs to manager placement and physical receipt. Dynamically recalculates product cost price using the Weighted Average Cost (AVCO) formula.

---

## Financial Integrity & Reversals

The system was rebuilt with an enterprise-grade financial core.

- **Reversal Engine**: Full support for **Partial Refunds** and **Void Sales**. Cashiers can look up past transactions by receipt number and initiate item-level returns.
- **Restock vs. Write-Off**: During a refund, cashiers specify if the returned item is undamaged (Restock) or damaged (Write-Off), maintaining perfect physical inventory parity.
- **Immutable Cash Drawer Ledger**: Physical cash movements—such as Safe Drops, Petty Cash withdrawals, Change Replenishments, and Cash Corrections—are logged to an append-only, immutable database ledger (`cash_drawer_adjustments`).
- **Shift Reconciliation**: Physical shift counting algorithms mathematically compare the live `expected_cash` (Starting Cash + Cash Sales - Cash Refunds + Pay Ins - Pay Outs) against the cashier's physical blind count to catch theft or discrepancies down to the penny.

---

## Security & Auditability

- **Contextual Manager Overrides**: Delicate POS activities (refunds, voids, large discounts, cash drops) trigger a prompt requesting a Manager's 4-digit bcrypt-hashed PIN. The UI employs "Override Context" to display the exact financial impact (e.g., `WRITE-OFF (Contains Damage)`) to the manager *before* they authorize the action, preventing authorization blindness.
- **Idempotency Protections**: Network boundaries are guarded by client-generated UUID idempotency keys. If a cashier accidentally double-taps "Checkout" or a network retry fires, the database intercepts the duplicate idempotency key and prevents double-billing the customer or double-deducting inventory.
- **Immutable DB Triggers**: Financial tables are locked down at the PostgreSQL trigger level to forbid `UPDATE` or `DELETE` actions, ensuring the audit trail cannot be scrubbed.

---

## Keyboard Shortcuts Map

The POS screen is designed to operate 100% without a mouse:

| Key | Action |
|-----|--------|
| `F1` / `SPACE` | Open Payment Modal |
| `F2` | Edit Quantity (if item selected) |
| `F3` | Apply Discount |
| `F4` | Transaction Search / Past Sales (Entry for Refund/Void) |
| `F5` | Open Product Catalog Search |
| `F6` | Suspended Carts Management (Hold / Resume) |
| `F7` | Attach Customer Profile |
| `F8` | Clear Active Cart (Wipe unsaved items) |
| `F9` | Drawer Actions (Safe Drop, Petty Cash) |
| `F12` | Exit POS (Requires Manager PIN) |

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

### 3. Set up environment

```bash
cp .env.example .env
```
Edit `.env` and fill in your database credentials and session secret.

### 4. Set up the database

```bash
# Creates the PostgreSQL user and database
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

### 5. Run database migrations & Seed Data

```bash
# Apply schemas
npm run migrate --workspace=packages/server

# Insert baseline dummy data and admin accounts
npm run seed --workspace=packages/server
```

### 6. Start development

```bash
npm run dev
```

---

## Packaged Windows App

The Windows installer is designed to run out of the box without a separate PostgreSQL installation. Electron starts a bundled PostgreSQL runtime, stores the database under the Windows user profile, runs migrations, creates the baseline admin account, and then starts the local API server.

Before building the Windows installer, place the PostgreSQL Windows x64 runtime under `vendor/postgres/win-x64`.

On first launch, the app creates `%APPDATA%/Talaat Market/postgres-data`.

Default first-run admin account:
- **Username**: `admin`
- **Password**: `admin123`
- **PIN**: `1111`

---

## System Architecture

```text
Electron (Main Process)
    ├── Spawns Express.js background server
    ├── Creates secure sandboxed window
    └── Intercepts Electron IPC channels (printing, OS metrics)

React Client (Renderer)
    ├── Communicates with Express via HTTP REST
    ├── State: Zustand (Local Persistent Cart) + TanStack Query (Server Cache)
    └── Active Cart Overwrite Protection (Prevents silent cart destruction)

Express.js Server
    ├── REST API on localhost:3001
    ├── Session authentication and Stateless JWT RBAC
    └── Zod validator parameters

PostgreSQL
    ├── Double-entry ledger tables & checks (inventory.quantity >= 0)
    ├── Append-only immutable triggers (cash_drawer_adjustments, audit_logs)
    └── Idempotency key tracking
```

---

## Project Structure

```
talaat-market/
├── package.json                  # Root workspace configuration
├── packages/
│   ├── client/                   # React frontend (Vite)
│   ├── server/                   # Express.js API & Knex migrations
│   └── desktop/                  # Electron desktop wrapper
└── scripts/
    └── setup-db.sh               # Database creation script
```

---

## Available Commands

```bash
# Start everything concurrently
npm run dev

# Code Quality & Validation
npm run typecheck
npm run lint
npm run format

# Building & Packaging
npm run build
npm run package --workspace=packages/desktop
```

---

## PostgreSQL Installation

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-client
sudo systemctl start postgresql
sudo systemctl enable postgresql
./scripts/setup-db.sh
```

### Windows Setup
1. Download PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer (remember your `postgres` superuser password)
3. Open PowerShell as Administrator and run:
   ```powershell
   psql -U postgres -c "CREATE USER talaat_user WITH PASSWORD 'your_password';"
   psql -U postgres -c "CREATE DATABASE talaat_market OWNER talaat_user;"
   psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE talaat_market TO talaat_user;"
   ```

---

## License

Proprietary — Talaat Market, 2026. All rights reserved.
