import fs from 'fs';

/** Refuse legacy clusters that allow passwordless access, including superusers. */
export function assertPasswordAuthentication(hbaPath: string): void {
  const rules = fs
    .readFileSync(hbaPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
  if (rules.some((line) => /\b(trust|peer|ident)\b/.test(line))) {
    throw new Error(
      'Managed PostgreSQL has passwordless authentication rules. Startup was stopped without modifying your data. A technician must secure pg_hba.conf and administrator credentials using the installation recovery guide.',
    );
  }
}
