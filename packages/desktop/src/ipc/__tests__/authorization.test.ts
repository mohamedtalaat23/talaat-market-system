import { randomUUID } from 'crypto';
import {
  HardwareAuthorization,
  AuthorizationDenied,
  AuthorityUnavailable,
  type Audit,
} from '../authorization';
import { IPC_CHANNELS as C } from '../channels';
const token = 'synthetic-session-token-never-production';
const envelope = () => ({ token, requestId: randomUUID(), employee: 1, role: 'admin' });
let now: number, events: Audit[], verify: jest.Mock, gate: HardwareAuthorization, effect: jest.Mock;
beforeEach(() => {
  now = 1000000;
  events = [];
  effect = jest.fn();
  verify = jest.fn().mockResolvedValue({ id: 7, role: 'cashier', validUntil: now + 3600000 });
  gate = new HardwareAuthorization(
    verify,
    (event) => events.push(event),
    () => now,
  );
});
it('authorizes a real cashier and audits the server identity, ignoring forged role/id fields', async () => {
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  expect(effect).toHaveBeenCalledTimes(1);
  expect(events.at(-1)).toMatchObject({ employee: 7, result: 'success' });
});
it.each([
  C.OPEN_CASH_DRAWER,
  C.PRINT_RECEIPT,
  C.RETRY_PRINT_JOB,
  C.CLEAR_PRINT_QUEUE,
  C.UPDATE_PRINTER_CONFIG,
  C.TEST_PRINTER,
  C.SELECT_FILE,
])('denies forged privilege via %s', async (op) => {
  await expect(gate.execute(op, envelope(), effect)).rejects.toThrow();
  expect(effect).not.toHaveBeenCalled();
});
it.each([undefined, {}, { token, requestId: 'bad' }])(
  'denies unauthenticated or malformed requests',
  async (auth) => {
    await expect(gate.execute(C.ENQUEUE_PRINT_JOB, auth, effect)).rejects.toThrow();
    expect(effect).not.toHaveBeenCalled();
  },
);
it('permits independently verified manager operations and admin-only configuration', async () => {
  verify.mockResolvedValue({ id: 8, role: 'manager', validUntil: now + 100000 });
  await gate.execute(C.OPEN_CASH_DRAWER, envelope(), effect);
  await expect(gate.execute(C.UPDATE_PRINTER_CONFIG, envelope(), effect)).rejects.toThrow();
  verify.mockResolvedValue({ id: 9, role: 'admin', validUntil: now + 100000 });
  await gate.execute(C.UPDATE_PRINTER_CONFIG, envelope(), effect);
  expect(effect).toHaveBeenCalledTimes(2);
});
it('consumes concurrent request nonces before dispatch and survives reconstruction', async () => {
  const auth = envelope();
  const result = await Promise.allSettled([
    gate.execute(C.ENQUEUE_PRINT_JOB, auth, effect),
    gate.execute(C.ENQUEUE_PRINT_JOB, auth, effect),
  ]);
  expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const restarted = new HardwareAuthorization(
    verify,
    (e) => events.push(e),
    () => now,
    [auth.requestId],
  );
  await expect(restarted.execute(C.ENQUEUE_PRINT_JOB, auth, effect)).rejects.toThrow(/Replayed/);
});
it('offline lease is bounded, cannot mint identity or elevate and recovers online', async () => {
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  verify.mockRejectedValue(new AuthorityUnavailable());
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  await expect(gate.execute(C.OPEN_CASH_DRAWER, envelope(), effect)).rejects.toThrow();
  now += 15 * 60000;
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
  verify.mockResolvedValue({ id: 7, role: 'cashier', validUntil: now + 100000 });
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
});
it('offline call budget cannot be refreshed by cached requests', async () => {
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  verify.mockRejectedValue(new AuthorityUnavailable());
  for (let i = 0; i < 100; i++) await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
});
it('explicit revocation/expiry invalidates offline authority and no cold-start fallback exists', async () => {
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  verify.mockRejectedValue(new AuthorizationDenied());
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
  verify.mockRejectedValue(new AuthorityUnavailable());
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
});
it('audit failure prevents hardware dispatch; hardware failure is recorded and cannot replay', async () => {
  const broken = new HardwareAuthorization(
    verify,
    () => {
      throw new Error('disk full');
    },
    () => now,
  );
  await expect(broken.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
  expect(effect).not.toHaveBeenCalled();
  const auth = envelope();
  effect.mockRejectedValue(new Error('paper out'));
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, auth, effect)).rejects.toThrow('paper out');
  expect(events.at(-1)?.result).toBe('failed');
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, auth, effect)).rejects.toThrow(/Replayed/);
});
it('queued retries revalidate, audit and deny revoked identities before dispatch', async () => {
  let permit: ReturnType<HardwareAuthorization['jobPermit']> | undefined;
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), () => {
    permit = gate.jobPermit();
  });
  verify.mockRejectedValue(new AuthorizationDenied());
  await expect(permit!()).rejects.toThrow();
  expect(events.at(-1)?.result).toBe('dispatch-denied');
});

it('expired identities and clock rollback fail closed', async () => {
  verify.mockResolvedValue({ id: 7, role: 'cashier', validUntil: now - 1 });
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
  expect(effect).not.toHaveBeenCalled();
});

it('accepts a server-verified drawer delegation only for that exact operation', async () => {
  verify.mockResolvedValue({
    id: 7,
    role: 'cashier',
    validUntil: now + 100000,
    approvedOperation: C.OPEN_CASH_DRAWER,
  });
  await gate.execute(C.OPEN_CASH_DRAWER, envelope(), effect, { manager_id: 2, pin: '482913' });
  await expect(gate.execute(C.PRINT_RECEIPT, envelope(), effect)).rejects.toThrow();
});

it('rejects wall clock rollback and authorizes no cold offline identity', async () => {
  verify.mockRejectedValue(new AuthorityUnavailable());
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow();
  verify.mockResolvedValue({ id: 7, role: 'cashier', validUntil: now + 100000 });
  await gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect);
  now--;
  await expect(gate.execute(C.ENQUEUE_PRINT_JOB, envelope(), effect)).rejects.toThrow(/backwards/);
});

it('audits explicit hardware failure responses and delegated queued outcomes', async () => {
  verify.mockResolvedValue({
    id: 7,
    role: 'cashier',
    approvedOperation: C.PRINT_RECEIPT,
    approvedBy: 8,
    validUntil: now + 100000,
  });
  let permit: ReturnType<HardwareAuthorization['jobPermit']> | undefined;
  await gate.execute(
    C.PRINT_RECEIPT,
    envelope(),
    () => {
      permit = gate.jobPermit();
      return { success: false };
    },
    { manager_id: 8, pin: '482913' },
  );
  expect(events.at(-1)).toMatchObject({ result: 'hardware-failed', employee: 7, approvedBy: 8 });
  await permit!();
  permit!.complete?.('failed');
  expect(events.at(-1)).toMatchObject({ result: 'job-failed', employee: 7, approvedBy: 8 });
});
