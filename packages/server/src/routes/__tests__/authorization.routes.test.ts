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

function mockEmployee(id: number, role: string, username: string) {
  (employeeRepository.findById as jest.Mock).mockResolvedValue({
    id,
    username,
    role,
    is_active: true,
    deleted_at: null,
  });
}

describe('Authorization route guards (regression)', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dashboard stats require authentication', async () => {
    await request(app).get('/api/v1/dashboard/stats').expect(401);
  });

  it('cashier cannot create a product', async () => {
    mockEmployee(1, 'cashier', 'cashier');
    const token = signToken(1, 'cashier', 'cashier');
    await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x', cost_price: 1, selling_price: 2 })
      .expect(403);
  });

  it('cashier cannot adjust inventory', async () => {
    mockEmployee(1, 'cashier', 'cashier');
    const token = signToken(1, 'cashier', 'cashier');
    await request(app)
      .post('/api/v1/inventory/adjust')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 1, adjustment_type: 'stock_addition', quantity_change: 5 })
      .expect(403);
  });

  it('cashier cannot create a cycle count', async () => {
    mockEmployee(1, 'cashier', 'cashier');
    const token = signToken(1, 'cashier', 'cashier');
    await request(app)
      .post('/api/v1/cycle-counts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'guided' })
      .expect(403);
  });

  it('cashier cannot approve a return queue', async () => {
    mockEmployee(1, 'cashier', 'cashier');
    const token = signToken(1, 'cashier', 'cashier');
    await request(app)
      .post('/api/v1/return-queues/some-id/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ return_condition_verified: true })
      .expect(403);
  });

  it('manager passes RBAC and reaches validation (not 401/403)', async () => {
    mockEmployee(2, 'manager', 'manager');
    const token = signToken(2, 'manager', 'manager');
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect([401, 403]).not.toContain(res.status);
  });

  it('blocks flagged accounts from business endpoints until the password is rotated', async () => {
    (employeeRepository.findById as jest.Mock).mockResolvedValue({
      id: 5,
      username: 'admin',
      role: 'admin',
      is_active: true,
      deleted_at: null,
      must_change_password: true,
    });
    const token = signToken(5, 'admin', 'admin');

    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
