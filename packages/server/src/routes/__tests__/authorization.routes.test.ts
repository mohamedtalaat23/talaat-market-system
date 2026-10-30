import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import { employeeRepository } from '../../repositories/employee.repository';

const SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    NODE_ENV: 'test',
    APP_NAME: 'Talaat Market',
  },
  isDev: false,
  isProd: false,
  isTest: true,
}));

jest.mock('../../config/database', () => ({
  db: Object.assign(jest.fn(), {
    raw: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(async (cb: any) => cb({})),
    fn: { now: () => new Date() },
  }),
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('../../middleware/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../repositories/employee.repository', () => ({
  employeeRepository: { findById: jest.fn() },
}));

function signToken(id: number, role: string, username: string): string {
  return jwt.sign({ id, username, role }, SECRET);
}

function mockEmployee(id: number, role: string, username: string, mustChange = false) {
  (employeeRepository.findById as jest.Mock).mockResolvedValue({
    id,
    username,
    role,
    is_active: true,
    deleted_at: null,
    must_change_password: mustChange,
  });
}

type TestFactory = (path: string) => request.Test;

type Api = Record<'get' | 'post' | 'put' | 'delete', TestFactory>;

function api(app: ReturnType<typeof createApp>): Api {
  return request(app) as unknown as Api;
}

/**
 * Every restricted operation is expected to be rejected for the lower role and
 * to at least clear the RBAC layer (i.e. not 401/403) for the role that owns it.
 * The important part is "reaches the handler": with the DB mocked the handler
 * itself may return any 4xx/5xx — what must never happen is a cashier reaching a
 * money/inventory mutation.
 */
const restrictedOperations: Array<{
  label: string;
  method: 'post' | 'put' | 'delete' | 'get';
  path: string;
  body?: Record<string, unknown>;
  deniedRole: 'cashier' | 'manager';
  allowedRole: 'manager' | 'admin';
}> = [
  {
    label: 'create a product',
    method: 'post',
    path: '/api/v1/products',
    body: { name: 'Test', barcode: 'B1', cost_price: 5, selling_price: 9 },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'update a product',
    method: 'put',
    path: '/api/v1/products/1',
    body: { name: 'Test' },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'delete a product',
    method: 'delete',
    path: '/api/v1/products/1',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'set stock levels directly',
    method: 'put',
    path: '/api/v1/inventory/1',
    body: { quantity: 100 },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'adjust stock relatively',
    method: 'post',
    path: '/api/v1/inventory/adjust',
    body: { product_id: 1, adjustment_type: 'stock_addition', quantity_change: 5 },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'create a product batch',
    method: 'post',
    path: '/api/v1/inventory/batches',
    body: { product_id: 1, batch_number: 'B-1', expiration_date: '2027-01-01', quantity: 5 },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'create a cycle count',
    method: 'post',
    path: '/api/v1/cycle-counts',
    body: { type: 'guided' },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'post a cycle count (reconcile inventory)',
    method: 'post',
    path: '/api/v1/cycle-counts/1/post',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'cancel a cycle count',
    method: 'post',
    path: '/api/v1/cycle-counts/1/cancel',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'approve a return queue',
    method: 'post',
    path: '/api/v1/return-queues/q1/approve',
    body: { return_condition_verified: true },
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'commit a return queue (restocks inventory)',
    method: 'post',
    path: '/api/v1/return-queues/q1/commit',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'soft-delete a customer',
    method: 'delete',
    path: '/api/v1/customers/1',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'read store settings',
    method: 'get',
    path: '/api/v1/settings',
    deniedRole: 'manager',
    allowedRole: 'admin',
  },
  {
    label: 'mutate store settings',
    method: 'put',
    path: '/api/v1/settings',
    body: { store_name: 'Hacked' },
    deniedRole: 'manager',
    allowedRole: 'admin',
  },
  {
    label: 'read financial reports',
    method: 'get',
    path: '/api/v1/reports/shifts',
    deniedRole: 'cashier',
    allowedRole: 'manager',
  },
  {
    label: 'register a new employee (role escalation)',
    method: 'post',
    path: '/api/v1/employees',
    body: {
      full_name: 'Rogue Admin',
      username: 'rogue_admin',
      password: 'long-enough-password',
      role: 'admin',
    },
    deniedRole: 'manager',
    allowedRole: 'admin',
  },
  {
    label: 'promote an existing employee',
    method: 'put',
    path: '/api/v1/employees/1',
    body: { role: 'admin' },
    deniedRole: 'manager',
    allowedRole: 'admin',
  },
];

describe('Authorization route guards (regression)', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dashboard stats require authentication', async () => {
    await request(app).get('/api/v1/dashboard/stats').expect(401);
  });

  it.each([
    ['get', '/api/v1/products'],
    ['post', '/api/v1/products'],
    ['get', '/api/v1/inventory'],
    ['post', '/api/v1/inventory/adjust'],
    ['post', '/api/v1/cycle-counts'],
    ['get', '/api/v1/return-queues'],
    ['get', '/api/v1/customers'],
    ['get', '/api/v1/settings'],
    ['get', '/api/v1/reports/shifts'],
    ['get', '/api/v1/employees'],
    ['get', '/api/v1/dashboard/stats'],
    ['post', '/api/v1/pos/checkout'],
    ['post', '/api/v1/pos/sync'],
  ])('%s %s requires a bearer token', async (method, path) => {
    const res = await api(app)[method as 'get' | 'post' | 'put' | 'delete'](path as string);

    expect(res.status).toBe(401);
  });

  it.each(restrictedOperations)(
    'a $deniedRole cannot $label',
    async ({ method, path, body, deniedRole }) => {
      const id = deniedRole === 'cashier' ? 11 : 12;
      mockEmployee(id, deniedRole, deniedRole);
      const token = signToken(id, deniedRole, deniedRole);

      const call = api(app)[method];
      const res = await call(path)
        .set('Authorization', `Bearer ${token}`)
        .send(body ?? {});

      expect(res.status).toBe(403);
    },
  );

  it.each(restrictedOperations)(
    'a $allowedRole can attempt to $label (not blocked by RBAC)',
    async ({ method, path, body, allowedRole }) => {
      const id = allowedRole === 'manager' ? 21 : 22;
      mockEmployee(id, allowedRole, allowedRole);
      const token = signToken(id, allowedRole, allowedRole);

      const call = api(app)[method];
      const res = await call(path)
        .set('Authorization', `Bearer ${token}`)
        .send(body ?? {});

      expect([401, 403]).not.toContain(res.status);
    },
  );

  it('blocks flagged accounts from business endpoints until the password is rotated', async () => {
    mockEmployee(5, 'admin', 'admin', true);
    const token = signToken(5, 'admin', 'admin');

    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('still lets a flagged account poll its own profile (so the UI can redirect)', async () => {
    mockEmployee(5, 'admin', 'admin', true);
    const token = signToken(5, 'admin', 'admin');

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, must_change_password: true });
  });

  it('rejects a token signed with a different secret', async () => {
    mockEmployee(7, 'admin', 'admin');
    const forged = jwt.sign({ id: 7, username: 'admin', role: 'admin' }, 'attacker-secret');

    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('rejects a token whose employee has been deactivated', async () => {
    (employeeRepository.findById as jest.Mock).mockResolvedValue({
      id: 8,
      username: 'fired',
      role: 'admin',
      is_active: false,
      deleted_at: null,
      must_change_password: false,
    });
    const token = signToken(8, 'admin', 'fired');

    const res = await request(app).get('/api/v1/products').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
