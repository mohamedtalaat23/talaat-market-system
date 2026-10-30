# Talaat Market System — Windows Deployment & Troubleshooting Guide

This document outlines the architecture, setup procedures, and troubleshooting guidelines for running, packaging, and deploying the **Talaat Market System** on Windows environments.

---

## 1. Architectural Overview

To deliver a zero-configuration, offline-first experience on Windows registers, the application utilizes a hybrid Electron shell configuration:

1. **Electron Shell Host:** Hosts the React frontend and acts as the process manager for backend services.
2. **Bundled PostgreSQL Database Engine:** Electron dynamically spawns and manages an isolated local PostgreSQL process on first launch. It does not run as a Windows Service, meaning no installation of database engines is required on target registers.
3. **Hidden Spooler Printing:** In-app thermal receipt printing is rendered as pre-formatted HTML inside a hidden `BrowserWindow` and spooled directly through Chromium's native Windows print spooler.

---

## 2. Directory Layout & Paths

All application state, configuration details, database records, and logs are persisted inside the active Windows user profile to ensure security isolation.

| Asset Type | Path | Purpose |
| :--- | :--- | :--- |
| **Local Config** | `%APPDATA%\Talaat Market\config.env` | Stores database credentials, dynamic ports, and session keys. |
| **Database Data** | `%APPDATA%\Talaat Market\postgres-data\` | Holds the raw PostgreSQL database cluster blocks. |
| **System Logs** | `%APPDATA%\Talaat Market\logs\` | Contains application backend and frontend transaction logs. |
| **Postgres Logs** | `%APPDATA%\Talaat Market\postgres.log` | Spool log for troubleshooting raw PostgreSQL boot errors. |
| **Backups Folder** | `%APPDATA%\Talaat Market\backups\` | Default local destination for database dumps. |

*Note: `%APPDATA%` usually maps to `C:\Users\<Username>\AppData\Roaming`.*

---

## 3. Installation Prerequisites (Build Steps)

Before compiling the Windows installer (`.exe`), you must bundle the PostgreSQL runtime binaries:

1. Download the **PostgreSQL Windows x64 Binaries** (ZIP format) from [pgbinaries.org](https://pgbinaries.org/) or [EnterpriseDB](https://www.enterprisedb.com/download-postgresql-binaries).
2. Extract the archive and place the contents of the `pgsql` directory under:
   ```text
   vendor/postgres/win-x64/
   ```
3. Ensure the folder structure contains `bin/postgres.exe`, `bin/initdb.exe`, `bin/pg_ctl.exe`, and all standard DLL dependencies.
4. Run the packaging command on a Windows build host:
   ```bash
   npm run build:win
   ```

---

## 4. Security and installation warnings

Do not disable Defender or add blanket application/profile exclusions. Stop if
security software blocks the package and have the technician verify the signed
release, PostgreSQL provenance and exact detection. Code signing identifies the
publisher; it does not guarantee that a package is safe or eliminate all alerts.

This release remains **NOT READY** for a paying customer. See
[commercial assessment](COMMERCIAL_READINESS.md),
[installation guide](INSTALLATION_GUIDE.md) and
[release checklist](RELEASE_CHECKLIST.md) for the current acceptance gates.
The managed database now requires password authentication. Older trust-based
clusters are refused without modifying their data; migration requires the
technician procedure in the installation guide.

---

## 5. Database Backup & Recovery Procedures

The database operates on a dynamic port (scanned on boot starting at `55432`). To interact with the database using utility tools, you must retrieve the current port and password from `%APPDATA%\Talaat Market\config.env`.

### 5.1 Backing Up the Database Manually
If you need to make a snapshot of the database manually, run the bundled `pg_dump.exe` tool from the directory where the application is installed:

```cmd
:: Read DB_PORT and DB_PASSWORD from %APPDATA%\Talaat Market\config.env first
set PGPASSWORD=your_database_password
"C:\Program Files\Talaat Market\resources\postgres\win-x64\bin\pg_dump.exe" -h 127.0.0.1 -p <DB_PORT> -U talaat_app -F c -b -v -f "C:\Path\To\backup.dump" talaat_market
```

### 5.2 Restoring from a Backup
To restore a `.dump` snapshot onto a fresh installation:

```cmd
:: Read DB_PORT and DB_PASSWORD from the fresh %APPDATA%\Talaat Market\config.env
set PGPASSWORD=your_database_password
"C:\Program Files\Talaat Market\resources\postgres\win-x64\bin\pg_restore.exe" -h 127.0.0.1 -p <DB_PORT> -U talaat_app -d talaat_market -c -v "C:\Path\To\backup.dump"
```

---

## 6. Thermal Printing Setup & Troubleshooting

The POS printing pipeline uses Chromium's native print spooler.

### 6.1 Configuring the Thermal Printer
1. Install the manufacturer's printer driver on Windows (e.g., **POS-80 series driver** or **POS-58 series driver**).
2. Print a Windows test page from **Settings** > **Devices** > **Printers & Scanners** to verify connectivity.
3. Open the **Talaat Market System** settings dashboard.
4. Select **System Printing** as the printer type.
5. Enter the exact printer name as registered in Windows (e.g., `POS-80` or `XP-80C`). If left blank, the system default printer will be used.

### 6.2 Troubleshooting Margins & Headers/Footers
If receipts print with unwanted page numbers, page dates, or URLs at the top or bottom:
* Ensure you are running the latest version of the app. The print option explicitly overrides margins using `{ marginType: 'none' }` to strip browser metadata.
* If margins are clipped, verify the paper width selected in settings (80mm vs 58mm) matches the loaded paper roll.

### 6.3 Printer Status shows "Offline" or fails to print
* Go to the Windows Services management console (`services.msc`) and restart the **Print Spooler** service.
* Make sure no other application has locked the printer driver (e.g., an old POS software).

---

## 7. Version Upgrades & Database Migrations

When releasing an update of the system:

1. **Schema Migrations:** If the database schema has changed, Knex migrations run automatically in the background on startup (`database/migrate.js`).
2. **Major PostgreSQL Version Upgrades:** If the bundled PG version upgrades (e.g., upgrading from Postgres 15 to Postgres 16), the database engine will refuse to run on the old data folder and crash on boot.
   * **Action Required:** Before deployment, export the database to a `.dump` file, clear `%APPDATA%\Talaat Market\postgres-data`, install the updated version, and restore the dump.

---

## 8. Multi-Register & External Database Configuration (Opt-Out Hook)

In a multi-register supermarket setup, you will want all registers to share a single centralized database server rather than spawning their own isolated databases.

The system includes a **DB_EXTERNAL** opt-out hook to bypass the local PostgreSQL runtime entirely and connect to an external server.

### Setup Instructions for Client Registers:
1. Ensure the primary database server is running PostgreSQL and accessible over the local network (LAN).
2. Create or edit the configuration file manually on each register at:
   ```text
   %APPDATA%\Talaat Market\config.env
   ```
3. Populate the file with the network database details:
   ```ini
   DB_EXTERNAL="true"
   DB_HOST="192.168.1.10"         # IP Address of your central server
   DB_PORT="5432"                 # Postgres port on the server
   DB_NAME="talaat_market"        # Shared database name
   DB_USER="talaat_network_user"  # Database username
   DB_PASSWORD="your_network_db_password"
   
   # Keep session and JWT keys matching across all registers
   SESSION_SECRET="your_shared_session_secret_min_32_chars"
   JWT_SECRET="your_shared_jwt_secret_min_32_chars"
   ```
4. Start the **Talaat Market System** application on the register.
5. The application will detect `DB_EXTERNAL="true"`, skip local PG checks (even if PostgreSQL binaries are not bundled or present on the register), and connect directly to the shared network database.
