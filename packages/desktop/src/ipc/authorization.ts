import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS as C } from './channels';

type Employee = {
  id: number;
  role: 'cashier' | 'manager' | 'admin';
  validUntil: number;
  approvedOperation?: string;
  approvedBy?: number;
};
type Envelope = { token: string; requestId: string };
type Lease = { employee: Employee; until: number; remaining: number };
export type Audit = {
  approvedBy?: number;
  time: string;
  operation: string;
  employee: number | null;
  result: string;
  requestId: string;
};
const publicChannels = new Set<string>([
  C.GET_SERVER_PORT,
  C.GET_APP_VERSION,
  C.MINIMIZE_WINDOW,
  C.MAXIMIZE_WINDOW,
  C.CLOSE_WINDOW,
]);
const cashier = new Set<string>([
  C.ENQUEUE_PRINT_JOB,
  C.GET_PRINT_JOBS,
  C.GET_PRINTER_STATUS,
  C.GET_PRINTER_CONFIG,
  C.PERSIST_OFFLINE_SALE,
  C.GET_OFFLINE_SALES,
  C.REMOVE_OFFLINE_SALE,
]);
const manager = new Set<string>([
  C.PRINT_RECEIPT,
  C.OPEN_CASH_DRAWER,
  C.RETRY_PRINT_JOB,
  C.CLEAR_PRINT_QUEUE,
  C.DISCOVER_PRINTERS,
]);
const admin = new Set<string>([
  C.UPDATE_PRINTER_CONFIG,
  C.TEST_PRINTER,
  C.SELECT_DIRECTORY,
  C.SELECT_FILE,
]);
const offline = new Set<string>([
  C.ENQUEUE_PRINT_JOB,
  C.GET_PRINT_JOBS,
  C.GET_PRINTER_STATUS,
  C.GET_PRINTER_CONFIG,
  C.PERSIST_OFFLINE_SALE,
  C.GET_OFFLINE_SALES,
]);
export class AuthorizationDenied extends Error {}
export class AuthorityUnavailable extends Error {}

export class HardwareAuthorization {
  private leases = new Map<string, Lease>();
  private used = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();
  private lastTime = 0;
  private active: ((() => Promise<void>) & { complete?: (result: string) => void }) | undefined;
  constructor(
    private verify: (token: string, operation: string, approval?: unknown) => Promise<Employee>,
    private audit: (event: Audit) => void,
    private now = Date.now,
    previousRequests: string[] = [],
  ) {
    previousRequests.forEach((id) => this.used.add(id));
  }
  rejected(operation: string): void {
    this.audit({
      time: new Date(this.now()).toISOString(),
      operation,
      employee: null,
      result: 'boundary-denied',
      requestId: '',
    });
  }
  private async identity(token: string, operation: string, approval?: unknown): Promise<Employee> {
    const now = this.now();
    if (now < this.lastTime) {
      this.leases.clear();
      throw new AuthorizationDenied('Clock moved backwards; reconnect and authenticate.');
    }
    this.lastTime = now;
    const key = crypto.createHash('sha256').update(token).digest('hex');
    try {
      const employee = await this.verify(token, operation, approval);
      if (
        !Number.isInteger(employee.id) ||
        employee.id <= 0 ||
        !['cashier', 'manager', 'admin'].includes(employee.role) ||
        !Number.isFinite(employee.validUntil) ||
        employee.validUntil <= now
      )
        throw new AuthorizationDenied('Invalid employee session.');
      // Online checks may refresh identity, but outages never refresh the lease.
      this.leases.set(key, {
        employee,
        until: Math.min(employee.validUntil, now + 15 * 60000),
        remaining: 100,
      });
      return employee;
    } catch (error) {
      if (!(error instanceof AuthorityUnavailable)) {
        this.leases.delete(key);
        throw error;
      }
      const lease = this.leases.get(key);
      if (!offline.has(operation) || !lease || now >= lease.until || lease.remaining <= 0)
        throw new AuthorizationDenied(
          'Hardware authorization unavailable. Reconnect to renew the offline lease.',
        );
      if (operation === C.ENQUEUE_PRINT_JOB || operation === C.PERSIST_OFFLINE_SALE)
        lease.remaining--;
      return lease.employee;
    }
  }
  jobPermit(): (() => Promise<void>) & { complete?: (result: string) => void } {
    if (!this.active) throw new AuthorizationDenied('Missing job authorization.');
    return this.active;
  }
  async execute<T>(
    requested: string | (() => string),
    envelope: unknown,
    effect: () => T | Promise<T>,
    approval?: unknown,
  ): Promise<T> {
    if (typeof requested === 'string' && publicChannels.has(requested)) return effect();
    const run = async () => {
      const operation = typeof requested === 'string' ? requested : requested();
      let actor: number | null = null;
      let approvedBy: number | undefined;
      let requestId = '';
      const record = (result: string) =>
        this.audit({
          time: new Date(this.now()).toISOString(),
          operation,
          employee: actor,
          ...(approvedBy === undefined ? {} : { approvedBy }),
          result,
          requestId,
        });
      try {
        if (!cashier.has(operation) && !manager.has(operation) && !admin.has(operation))
          throw new AuthorizationDenied('Operation is disabled.');
        const auth = envelope as Partial<Envelope> | null;
        if (
          !auth ||
          typeof auth.token !== 'string' ||
          auth.token.length < 20 ||
          auth.token.length > 8192 ||
          typeof auth.requestId !== 'string' ||
          !/^[a-f0-9-]{36}$/i.test(auth.requestId)
        )
          throw new AuthorizationDenied('Authenticated IPC envelope required.');
        requestId = auth.requestId;
        if (this.used.has(requestId)) throw new AuthorizationDenied('Replayed hardware request.');
        const token = auth.token;
        const employee = await this.identity(token, operation, approval);
        actor = employee.id;
        approvedBy = employee.approvedBy;
        if (
          (manager.has(operation) &&
            employee.role === 'cashier' &&
            employee.approvedOperation !== operation) ||
          (admin.has(operation) && employee.role !== 'admin')
        )
          throw new AuthorizationDenied('Employee is not permitted to perform this operation.');
        record('authorized'); // Durable before consumption/side effect; audit failure denies dispatch.
        this.used.add(requestId);
        this.active = async () => {
          try {
            const fresh = await this.identity(token, operation, approval);
            if (
              (manager.has(operation) &&
                fresh.role === 'cashier' &&
                fresh.approvedOperation !== operation) ||
              (admin.has(operation) && fresh.role !== 'admin')
            )
              throw new AuthorizationDenied('Job permission revoked.');
            record('dispatch');
          } catch (error) {
            record('dispatch-denied');
            throw error;
          }
        };
        this.active.complete = (result: string) => record(`job-${result}`);
        const result = await effect();
        record(
          result === false ||
            (result &&
              typeof result === 'object' &&
              'success' in result &&
              result.success === false) ||
            (result && typeof result === 'object' && 'online' in result && result.online === false)
            ? 'hardware-failed'
            : 'success',
        );
        return result;
      } catch (error) {
        record(error instanceof AuthorizationDenied ? 'denied' : 'failed');
        throw error;
      } finally {
        this.active = undefined;
      }
    };
    const task = this.tail.then(run, run);
    this.tail = task.catch(() => undefined);
    return task;
  }
}

export function authorityUrl(serverPort: number, configured?: string): string {
  if (!configured) return `http://localhost:${serverPort}/api/v1/auth/hardware-session`;
  const url = new URL(configured);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new AuthorizationDenied('Hardware authority must be a trusted HTTPS origin.');
  return `${url.origin}/api/v1/auth/hardware-session`;
}

export function createHardwareAuthorization(
  serverPort: number,
  auditFile: string,
): HardwareAuthorization {
  const configFile = path.join(path.dirname(auditFile), 'config.env');
  const rawAuthority = fs.existsSync(configFile)
    ? /^HARDWARE_AUTHORITY_URL=(.*)$/m.exec(fs.readFileSync(configFile, 'utf8'))?.[1]?.trim()
    : undefined;
  const endpoint = authorityUrl(
    serverPort,
    rawAuthority?.startsWith('"') ? (JSON.parse(rawAuthority) as string) : rawAuthority,
  );
  const previous = fs.existsSync(auditFile)
    ? fs
        .readFileSync(auditFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Audit)
    : [];
  return new HardwareAuthorization(
    async (token, operation, approval) => {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({ operation, approval }),
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        throw new AuthorityUnavailable('Local authentication service unavailable.');
      }
      if (!response.ok) throw new AuthorizationDenied('Employee session rejected.');
      return ((await response.json()) as { data: Employee }).data;
    },
    (event) => {
      const fd = fs.openSync(auditFile, 'a', 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify(event) + '\n');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    },
    Date.now,
    previous.filter((event) => event.result === 'authorized').map((event) => event.requestId),
  );
}
