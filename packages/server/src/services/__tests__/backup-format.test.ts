import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupValidationError,
  assertSafeRestoreTarget,
  computePayloadChecksum,
  decodeRow,
  encodeRow,
  orderTables,
  validateBackupPayload,
  type SchemaInfo,
} from '../backup-format';

/**
 * Backup format / validation unit tests (no database required).
 *
 * These cover the checks that must pass *before* any restore writes data:
 * checksum, schema version, referential integrity and insert ordering.
 */
const schema: SchemaInfo = {
  foreignKeys: [
    { table: 'sale_items', column: 'sale_id', referencedTable: 'sales' },
    { table: 'sales', column: 'shift_id', referencedTable: 'cashier_shifts' },
    { table: 'sales', column: 'cashier_id', referencedTable: 'employees' },
    { table: 'cashier_shifts', column: 'employee_id', referencedTable: 'employees' },
  ],
  primaryKeys: {
    employees: 'id',
    cashier_shifts: 'id',
    sales: 'id',
    sale_items: 'id',
  },
};

function buildPayload(overrides: { data?: Record<string, unknown[]> } = {}) {
  const data: Record<string, any[]> = (overrides.data as Record<string, any[]>) ?? {
    employees: [{ id: 1, username: 'admin' }],
    cashier_shifts: [{ id: 10, employee_id: 1 }],
    sales: [{ id: 'sale-1', shift_id: 10, cashier_id: 1, total: '19.99' }],
    sale_items: [{ id: 'item-1', sale_id: 'sale-1', unit_price: '19.99' }],
  };

  const tableOrder = Object.keys(data);
  const rowCounts = Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [table, rows.length]),
  );

  return {
    meta: {
      system: 'Talaat Market System',
      format: BACKUP_FORMAT,
      format_version: BACKUP_FORMAT_VERSION,
      app_version: 'test',
      created_at: new Date().toISOString(),
      tables_included: tableOrder,
      table_order: tableOrder,
      row_counts: rowCounts,
      migrations: ['001_initial_schema.ts', '035_credential_rotation_and_payment_integrity.ts'],
      credentials_included: true,
      sensitivity: 'confidential' as const,
      payload_sha256: computePayloadChecksum(data, tableOrder),
    },
    data,
  };
}

describe('backup format validation', () => {
  it('accepts a well-formed backup', () => {
    const payload = buildPayload();
    const result = validateBackupPayload(payload, schema, {
      currentMigrations: payload.meta.migrations,
    });

    expect(result.tables).toEqual(['employees', 'cashier_shifts', 'sales', 'sale_items']);
    expect(result.rowCounts['sale_items']).toBe(1);
  });

  it('rejects a tampered payload', () => {
    const payload = buildPayload();
    payload.data['sales']![0]!['total'] = '0.01';

    expect(() => validateBackupPayload(payload, schema)).toThrow(/checksum/i);
  });

  it('rejects an unknown format or version', () => {
    const payload = buildPayload();
    expect(() =>
      validateBackupPayload(
        { ...payload, meta: { ...payload.meta, format: 'catalogue-export' } },
        schema,
      ),
    ).toThrow(/Unsupported backup format/);

    expect(() =>
      validateBackupPayload({ ...payload, meta: { ...payload.meta, format_version: 1 } }, schema),
    ).toThrow(/Unsupported backup format version/);
  });

  it('rejects a row-count mismatch', () => {
    const payload = buildPayload();
    payload.meta.row_counts['sales'] = 99;

    expect(() => validateBackupPayload(payload, schema)).toThrow(/declares 99/);
  });

  it('rejects a backup taken on another schema version', () => {
    const payload = buildPayload();

    expect(() =>
      validateBackupPayload(payload, schema, {
        currentMigrations: ['001_initial_schema.ts'],
      }),
    ).toThrow(/different schema version/);
  });

  it('rejects rows that point at parents missing from the file', () => {
    const payload = buildPayload({
      data: {
        employees: [],
        cashier_shifts: [],
        sales: [{ id: 'sale-1', shift_id: 10, cashier_id: 1 }],
        sale_items: [],
      },
    });

    expect(() => validateBackupPayload(payload, schema)).toThrow(/referencing records/);
  });

  it('reports the failing column without leaking row data', () => {
    const payload = buildPayload({
      data: {
        employees: [{ id: 1 }],
        cashier_shifts: [{ id: 10, employee_id: 1 }],
        sales: [{ id: 'sale-1', shift_id: 99, cashier_id: 1, customer_phone: '01000000000' }],
        sale_items: [],
      },
    });

    try {
      validateBackupPayload(payload, schema);
      throw new Error('expected validation to fail');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toContain('sales.shift_id');
      expect(message).not.toContain('01000000000');
    }
  });
});


describe('orderTables', () => {
  it('places parents before children regardless of input order', () => {
    const ordered = orderTables(['sale_items', 'sales', 'cashier_shifts', 'employees'], schema);

    expect(ordered.indexOf('employees')).toBeLessThan(ordered.indexOf('cashier_shifts'));
    expect(ordered.indexOf('cashier_shifts')).toBeLessThan(ordered.indexOf('sales'));
    expect(ordered.indexOf('sales')).toBeLessThan(ordered.indexOf('sale_items'));
  });

  it('refuses a schema with a reference cycle instead of guessing', () => {
    const cyclic: SchemaInfo = {
      foreignKeys: [
        { table: 'a', column: 'b_id', referencedTable: 'b' },
        { table: 'b', column: 'a_id', referencedTable: 'a' },
      ],
      primaryKeys: { a: 'id', b: 'id' },
    };

    expect(() => orderTables(['a', 'b'], cyclic)).toThrow(BackupValidationError);
    expect(() => orderTables(['a', 'b'], cyclic)).toThrow(/circular foreign keys/i);
  });

  it('allows self-referencing tables', () => {
    const selfRef: SchemaInfo = {
      foreignKeys: [{ table: 'categories', column: 'parent_id', referencedTable: 'categories' }],
      primaryKeys: { categories: 'id' },
    };

    expect(orderTables(['categories'], selfRef)).toEqual(['categories']);
  });
});

describe('value encoding', () => {
  it('round-trips bytea buffers', () => {
    const encoded = encodeRow({ id: 1, signature: Buffer.from('abc') });
    expect(encoded['signature']).toEqual({ __bytea: Buffer.from('abc').toString('base64') });

    const decoded = decodeRow(encoded);
    expect(Buffer.isBuffer(decoded['signature'])).toBe(true);
    expect(decoded['signature']).toEqual(Buffer.from('abc'));
  });

  it('keeps numeric strings (money) untouched', () => {
    const encoded = encodeRow({ total: '19.99' });
    expect(encoded['total']).toBe('19.99');
  });

  it('serialises dates as ISO strings', () => {
    const date = new Date('2026-01-02T03:04:05.000Z');
    expect(encodeRow({ created_at: date })['created_at']).toBe('2026-01-02T03:04:05.000Z');
  });
});

describe('restore target safety', () => {
  it('refuses to restore into the live database', () => {
    expect(() => assertSafeRestoreTarget('talaat_market', 'talaat_market')).toThrow(
      /Refusing to restore into the live database/,
    );
  });

  it('requires a target', () => {
    expect(() => assertSafeRestoreTarget('', 'talaat_market')).toThrow(
      /target database name is required/i,
    );
  });

  it('rejects unsafe identifiers', () => {
    expect(() => assertSafeRestoreTarget('restore; DROP DATABASE x', 'talaat_market')).toThrow(
      /letters, digits and underscores/,
    );
  });

  it('accepts a separate database name', () => {
    expect(() => assertSafeRestoreTarget('talaat_market_restore', 'talaat_market')).not.toThrow();
  });
});
