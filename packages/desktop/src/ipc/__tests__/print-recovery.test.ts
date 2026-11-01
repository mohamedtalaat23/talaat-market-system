import { app } from 'electron';
import { PrintQueue } from '../print-queue';
import type { Receipt } from '../printing-types';

import Store from 'electron-store';
jest.mock('electron-store', () => {
  const data: Record<string, unknown> = {};
  return {
    __esModule: true,
    default: class {
      static data = data;
      get(key: string) {
        return data[key];
      }
      set(key: string, value: unknown) {
        data[key] = JSON.parse(JSON.stringify(value));
      }
    },
  };
});
const mockData = (Store as unknown as { data: Record<string, unknown> }).data;
jest.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: { getAllWindows: () => [] },
}));

beforeEach(() => {
  for (const key of Object.keys(mockData)) delete mockData[key];
});
it('retains interrupted print jobs as failed for explicit operator recovery', () => {
  mockData['printJobs'] = [
    {
      id: 'interrupted',
      status: 'processing',
      receipt: {},
      attempts: 1,
      createdAt: new Date().toISOString(),
      error: null,
    },
  ];
  const queue = new PrintQueue();
  expect(queue.getJobs()[0]).toMatchObject({ id: 'interrupted', status: 'failed' });
  expect(queue.getJobs()[0]?.error).toMatch(/Check the physical receipt/);
});
it('cannot report a mock printer as a successful production print', async () => {
  expect(app.isPackaged).toBe(true);
  mockData['printerConfig'] = { type: 'mock', paperWidth: 80, retries: 1 };
  const queue = new PrintQueue();
  queue.enqueue({ receiptNumber: 'SYNTHETIC', paymentMethod: 'cash' } as Receipt, async () => {});
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(queue.getJobs()[0]?.status).toBe('failed');
  expect(queue.getJobs()[0]?.error).toMatch(/PRINTER_NOT_CONFIGURED/);
  expect((mockData['printJobs'] as { status: string }[])[0]?.status).toBe('failed');
});
