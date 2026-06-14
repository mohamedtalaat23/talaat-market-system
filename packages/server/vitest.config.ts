import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/repositories/__tests__/db_check.test.ts',
      'src/repositories/__tests__/drawer_adjustments.test.ts',
      'src/repositories/__tests__/reversal.test.ts',
      'src/repositories/__tests__/shift_reconciliation.test.ts',
      'src/repositories/__tests__/purchase_integration.test.ts'
    ],
    // Force sequential test execution when testing against a single shared DB to prevent collision
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
  },
});
