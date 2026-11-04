import { test as base } from '@playwright/test';
import { db } from './daily-helpers';
// Files share the Knex module within a worker. Close it at the worker boundary,
// not at a file boundary where the next journey would inherit a destroyed pool.
export const test = base.extend<object, { databaseLifecycle: void }>({
  databaseLifecycle: [
    async ({}, use) => {
      await use();
      await (await db()).destroy();
    },
    { scope: 'worker', auto: true },
  ],
});
