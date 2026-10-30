import { afterAll, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { createApp } from '../../app';
import { posRepository } from '../pos.repository';
import { setupTestData } from './reversal_setup';
const app = createApp();
const sign = (id: number, extra = {}) =>
  jwt.sign({ id, username: 'synthetic', role: 'admin', ae: 0, ...extra }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
afterAll(async () => {
  await db.destroy();
});
it('hardware identity uses current database role, denies revoked/expired/unauthenticated sessions', async () => {
  const c = await setupTestData();
  expect((await request(app).post('/api/v1/auth/hardware-session').send({})).status).toBe(401);
  const token = sign(c.cashierId);
  const result = await request(app)
    .post('/api/v1/auth/hardware-session')
    .auth(token, { type: 'bearer' })
    .send({ operation: 'printer:enqueue-job', role: 'admin', employee: c.managerId });
  expect(result.status).toBe(200);
  expect(result.body.data).toMatchObject({ id: c.cashierId, role: 'cashier' });
  await db('employees').where({ id: c.cashierId }).update({ must_change_password: true });
  expect(
    (await request(app).post('/api/v1/auth/hardware-session').auth(token, { type: 'bearer' }))
      .status,
  ).toBe(403);
  await db('employees')
    .where({ id: c.cashierId })
    .update({ must_change_password: false, auth_epoch: 1 });
  expect(
    (await request(app).post('/api/v1/auth/hardware-session').auth(token, { type: 'bearer' }))
      .status,
  ).toBe(401);
  const expired = jwt.sign(
    { id: c.managerId, ae: 0, exp: Math.floor(Date.now() / 1000) - 1 },
    env.JWT_SECRET,
  );
  expect(
    (await request(app).post('/api/v1/auth/hardware-session').auth(expired, { type: 'bearer' }))
      .status,
  ).toBe(401);
});
it('cashier drawer delegation requires a real current manager PIN; unsynced queue deletion is denied', async () => {
  const c = await setupTestData();
  const token = sign(c.cashierId);
  await db('employees')
    .where({ id: c.managerId })
    .update({ pin_hash: await bcrypt.hash('482913', 4) });
  const call = (body: object) =>
    request(app).post('/api/v1/auth/hardware-session').auth(token, { type: 'bearer' }).send(body);
  expect(
    (
      await call({
        operation: 'printer:open-cash-drawer',
        approval: { manager_id: c.managerId, pin: '0000' },
      })
    ).status,
  ).toBe(403);
  const success = await call({
    operation: 'printer:open-cash-drawer',
    approval: { manager_id: c.managerId, pin: '482913' },
  });
  const sale = await posRepository.checkout(
    {
      shift_id: c.shiftId,
      register_id: c.registerId,
      payment_method: 'cash',
      cash_received: 10,
      idempotency_key: `reprint-${Date.now()}`,
      items: [{ product_id: c.productId, quantity: 1, unit_price: 10, discount: 0 }],
    },
    c.cashierId,
  );
  const reprint = (pin: string) =>
    request(app)
      .post(`/api/v1/pos/receipts/${sale.id}/reprint`)
      .auth(token, { type: 'bearer' })
      .send({ manager_id: c.managerId, manager_pin: pin });
  expect((await reprint('0000')).status).toBe(403);
  expect((await reprint('482913')).status).toBe(200);
  expect(success.status).toBe(200);
  expect(success.body.data.approvedOperation).toBe('printer:open-cash-drawer');
  expect(
    (
      await call({
        operation: 'offline:remove-sale',
        approval: '11111111-1111-4111-8111-111111111111',
      })
    ).status,
  ).toBe(403);
});
