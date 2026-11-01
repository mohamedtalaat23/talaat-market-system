import { randomUUID } from 'crypto';
import { registerIpcHandlers } from '../handlers';
import { IPC_CHANNELS as C } from '../channels';
import { printQueue } from '../print-queue';
import { EscPosFormatter } from '../escpos-formatter';
import { parsePrinterConfigArgs } from '../validation';
const verify = jest.fn();
jest.mock('../authorization', () => {
  const real = jest.requireActual('../authorization');
  return {
    ...real,
    createHardwareAuthorization: () =>
      new real.HardwareAuthorization(
        (...args: unknown[]) => verify(...args),
        () => {},
      ),
  };
});
jest.mock('electron-store', () => ({
  __esModule: true,
  default: class {
    data: Record<string, unknown> = {};
    get(k: string, fallback: unknown) {
      return this.data[k] ?? fallback;
    }
    set(k: string, v: unknown) {
      this.data[k] = v;
    }
  },
}));
jest.mock('electron', () => ({ app: { getPath: () => '/tmp' }, BrowserWindow: {} }));
jest.mock('../print-queue', () => ({
  printQueue: {
    enqueue: jest.fn().mockReturnValue({ id: 'job' }),
    kickDrawer: jest.fn(),
    retryJob: jest.fn(),
    updateConfig: jest.fn(),
  },
}));
const receipt = {
  receiptNumber: 'synthetic-receipt',
  cashierName: 'Synthetic',
  storeName: 'Test',
  items: [{ name: 'Coffee', quantity: 1, unit: 'pcs', unitPrice: 10, discount: 0, lineTotal: 10 }],
  totals: { subtotal: 10, discount: 0, tax: 0, total: 10 },
  timestamp: new Date().toISOString(),
  paymentMethod: 'cash',
};
let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;
const auth = () => ({
  token: 'synthetic-verified-token-only',
  requestId: randomUUID(),
  role: 'admin',
});
beforeEach(() => {
  jest.clearAllMocks();
  handlers = new Map();
  verify.mockResolvedValue({ id: 7, role: 'cashier', validUntil: Date.now() + 3600000 });
  registerIpcHandlers(
    {
      handle: (c: string, f: (...args: unknown[]) => Promise<unknown>) => handlers.set(c, f),
    } as never,
    { serverPort: 3001, assertTrustedSender: () => {} },
  );
});
it('direct registered IPC calls require authentication and deny alternative print/retry/config/drawer paths', async () => {
  await expect(handlers.get(C.ENQUEUE_PRINT_JOB)!({}, receipt)).rejects.toThrow();
  await handlers.get(C.ENQUEUE_PRINT_JOB)!({}, receipt, auth());
  expect(printQueue.enqueue).toHaveBeenCalledTimes(1);
  await expect(
    handlers.get(C.ENQUEUE_PRINT_JOB)!({}, { ...receipt, isReprint: false }, auth()),
  ).rejects.toThrow();
  for (const [op, arg] of [
    [C.PRINT_RECEIPT, { html: 'fake' }],
    [C.RETRY_PRINT_JOB, 'job'],
    [C.UPDATE_PRINTER_CONFIG, {}],
    [C.OPEN_CASH_DRAWER, {}],
  ] as const) {
    await expect(handlers.get(op)!({}, arg, auth())).rejects.toThrow();
  }
  expect(printQueue.kickDrawer).not.toHaveBeenCalled();
  expect(printQueue.retryJob).not.toHaveBeenCalled();
  expect(printQueue.updateConfig).not.toHaveBeenCalled();
});
it('concurrent fresh-nonce repeats still require manager reprint authorization', async () => {
  const results = await Promise.allSettled([
    handlers.get(C.ENQUEUE_PRINT_JOB)!({}, receipt, auth()),
    handlers.get(C.ENQUEUE_PRINT_JOB)!({}, receipt, auth()),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});
it('receipt data cannot inject a raw drawer pulse and printer tests cannot target arbitrary files', () => {
  const bytes = EscPosFormatter.format(['Coffee\x1bp\x00\x19\xfa'], false);
  expect(Buffer.from(bytes).includes(Buffer.from([0x1b, 0x70]))).toBe(false);
  expect(() =>
    parsePrinterConfigArgs([{ type: 'usb', devicePath: '/tmp/customer-database', paperWidth: 80 }]),
  ).toThrow();
});
