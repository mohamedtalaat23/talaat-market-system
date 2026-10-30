const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'vendor/postgres/win-x64');
const missing = ['initdb.exe', 'postgres.exe', 'pg_ctl.exe', 'createdb.exe', 'psql.exe'].filter(file => !fs.existsSync(path.join(directory, 'bin', file)));
if (missing.length) throw new Error(`Windows installer blocked: supply the verified PostgreSQL runtime and its required DLLs/licenses in ${directory}. Missing: ${missing.join(', ')}`);
