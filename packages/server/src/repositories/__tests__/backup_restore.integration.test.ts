import { afterAll, describe, expect, it, vi } from 'vitest';
import knex, { type Knex } from 'knex';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { backupService } from '../../services/backup.service';
import { restoreService } from '../../services/restore.service';
import { assertSafeRestoreTarget } from '../../services/backup-format';
import { posRepository } from '../pos.repository';
import { setupTestData } from './reversal_setup';

// Explicitly provision a disposable, migrated target before enabling this test.
const targetDatabase = process.env['RESTORE_TEST_DATABASE'];
describe.skipIf(!targetDatabase)('backup and restore on PostgreSQL', () => {
  const target = knex({
    client: 'pg',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: targetDatabase,
    },
  });

  afterAll(async () => {
    await target.destroy();
    await db.destroy();
  });

  it('restores a complete snapshot, rejects reused targets, and restores without credentials', async () => {
    assertSafeRestoreTarget(targetDatabase!, env.DB_NAME);
    const ctx = await setupTestData();
    await posRepository.checkout(
      {
        shift_id: ctx.shiftId,
        register_id: ctx.registerId,
        payment_method: 'cash',
        cash_received: 10,
        idempotency_key: `restore-sale-${Date.now()}`,
        items: [{ product_id: ctx.productId, quantity: 1, unit_price: 10, discount: 0 }],
      },
      ctx.cashierId,
    );
    // High, non-contiguous IDs expose incorrect serial-sequence resets.
    await db('customers')
      .insert({ id: 900001, name: 'Restore sequence regression', balance: 0 })
      .onConflict('id')
      .ignore();
    await db('settings')
      .insert({ key: 'restore_json_test', value: JSON.stringify(['cash', { nested: [1, 2] }]) })
      .onConflict('key')
      .merge();
    const before = await db('customers').count('* as count').first();
    const backup = await backupService.createBackup();
    const options = { file: backup.filename, targetDatabase: targetDatabase! };
    expect((await restoreService.restore(options)).applied).toBe(false);
    expect(Number((await target('employees').count('* as count').first())!.count)).toBe(0);
    const report = await restoreService.restore({ ...options, apply: true });
    expect(report.applied).toBe(true);
    expect((await target('settings').where({ key: 'restore_json_test' }).first()).value).toEqual([
      'cash',
      { nested: [1, 2] },
    ]);
    for (const sequence of [
      'receipt_number_seq',
      'refund_receipt_number_seq',
      'purchase_order_number_seq',
    ]) {
      const restored = await target.raw('SELECT last_value FROM ??', [sequence]);
      expect(Number(restored.rows[0].last_value)).toBeGreaterThanOrEqual(
        sequence === 'receipt_number_seq' ? 2 : 1,
      );
    }
    expect(await target('customers').where({ id: ctx.customerId }).first()).toMatchObject({
      balance: '-50.00',
    });
    const [next] = await target('customers').insert({ name: 'After restore' }).returning('id');
    expect(next.id).toBeGreaterThan(900001);
    expect(await db('customers').count('* as count').first()).toEqual(before);
    await expect(restoreService.restore({ ...options, apply: true })).rejects.toMatchObject({
      code: 'TARGET_NOT_EMPTY',
    });

    // Only clear the explicitly supplied disposable target, using FK-safe order.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const payload = JSON.parse(
      fs.readFileSync(path.join(backupService.directory, backup.filename), 'utf8'),
    );
    await target.raw(
      `TRUNCATE TABLE ${payload.meta.table_order.map(() => '??').join(', ')}`,
      payload.meta.table_order,
    );
    const redacted = await backupService.createBackup({ includeCredentials: false });
    await restoreService.restore({
      file: redacted.filename,
      targetDatabase: targetDatabase!,
      apply: true,
    });
    const restored = await target('employees').where({ id: ctx.managerId }).first();
    expect(restored.credential_rotation_required).toBe(true);
    expect(restored.must_change_password).toBe(true);
    expect(typeof restored.password_hash).toBe('string');
    expect(restored.password_hash).not.toBe('hashed');
    expect(restored.pin_hash).toBeNull();
  });
  it('keeps concurrent writes outside the backup snapshot', async () => {
    const marker = `snapshot-${Date.now()}`;
    // Pause after the first read established the transaction's MVCC snapshot,
    // then commit an unrelated write through a separate pooled connection.
    const internals = backupService as unknown as {
      listTables: (connection: Knex) => Promise<string[]>;
    };
    const original = internals.listTables.bind(backupService);
    const spy = vi.spyOn(internals, 'listTables').mockImplementationOnce(async (connection) => {
      const tables = await original(connection);
      await db('customers').insert({ name: marker });
      return tables;
    });
    try {
      const backup = await backupService.createBackup();
      const fs = await import('node:fs');
      const path = await import('node:path');
      const payload = JSON.parse(
        fs.readFileSync(path.join(backupService.directory, backup.filename), 'utf8'),
      );
      expect(payload.data.customers.some((row: { name: string }) => row.name === marker)).toBe(
        false,
      );
      expect(await db('customers').where({ name: marker }).first()).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  });
});
