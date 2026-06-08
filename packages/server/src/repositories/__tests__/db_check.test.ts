import { describe, it, expect } from 'vitest';
import { db } from '../../config/database';

describe('DB connection', () => {
  it('connects', async () => {
    const res = await db.raw('SELECT 1+1 as result');
    expect(res.rows[0].result).toBe(2);
  });
});
