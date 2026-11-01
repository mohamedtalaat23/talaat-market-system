import type { WebContents } from 'electron';
import {
  IpcSecurityError,
  IpcValidationError,
  createSenderGuard,
  parseFileFiltersArgs,
  parseOfflineSaleArgs,
  parseOfflineSaleIdArgs,
  parsePrintReceiptArgs,
  parsePrinterConfigArgs,
  parseReceiptArgs,
} from '../validation';

/**
 * Electron IPC hardening tests.
 *
 * The renderer is untrusted: every payload must be rejected when malformed, and a
 * request from any frame other than the app's top-level window must be refused
 * before a handler runs.
 */

const validReceipt = {
  receiptNumber: 'STR01-REG01-20260101-00001',
  cashierName: 'Cashier',
  storeName: 'Talaat Market',
  storeAddress: '1 Main St',
  storePhone: '0100',
  items: [
    {
      name: 'Coffee',
      name_ar: 'قهوة',
      barcode: 'C1',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 19.99,
      discount: 0,
      lineTotal: 39.98,
    },
  ],
  totals: {
    subtotal: 39.98,
    discount: 0,
    globalDiscount: 0,
    tax: 0,
    total: 39.98,
    cashReceived: 50,
    changeGiven: 10.02,
  },
  timestamp: new Date().toISOString(),
  paymentMethod: 'cash',
};

describe('print payload validation', () => {
  it('accepts a well-formed receipt', () => {
    const receipt = parseReceiptArgs([validReceipt]);
    expect(receipt.receiptNumber).toBe(validReceipt.receiptNumber);
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0]?.name_ar).toBe('قهوة');
  });

  it('rejects a receipt with a negative or non-numeric total', () => {
    expect(() =>
      parseReceiptArgs([
        { ...validReceipt, totals: { ...validReceipt.totals, total: Number.NaN } },
      ]),
    ).toThrow(IpcValidationError);

    expect(() =>
      parseReceiptArgs([{ ...validReceipt, totals: { ...validReceipt.totals, total: -1 } }]),
    ).toThrow(/total/);
  });

  it('rejects a receipt with no items', () => {
    expect(() => parseReceiptArgs([{ ...validReceipt, items: [] }])).toThrow(IpcValidationError);
  });

  it('rejects a payload that is not an object', () => {
    expect(() => parseReceiptArgs(['not-a-receipt'])).toThrow(/expected object/);
    expect(() => parseReceiptArgs([undefined])).toThrow(/expected object/);
  });

  it('accepts pre-rendered HTML and rejects junk', () => {
    expect(parsePrintReceiptArgs([{ html: '<html><body>ticket</body></html>' }]).html).toContain(
      'ticket',
    );

    expect(() => parsePrintReceiptArgs([{ html: '' }])).toThrow(IpcValidationError);
    expect(() => parsePrintReceiptArgs([{ html: 'javascript:alert(1)' }])).toThrow(/HTML document/);
    expect(() => parsePrintReceiptArgs([{ html: '<div>' + 'x'.repeat(600_000) }])).toThrow(
      /at most/,
    );
  });

describe('printer config validation', () => {
  const base = {
    type: 'usb',
    paperWidth: 80,
    devicePath: '/dev/usb/lp0',
    deviceName: 'POS-80',
    autoPrint: true,
    retries: 2,
  };

  it('accepts a valid config', () => {
    expect(parsePrinterConfigArgs([base])).toMatchObject({ type: 'usb', paperWidth: 80 });
  });

  it('rejects an unknown printer type or paper width', () => {
    expect(() => parsePrinterConfigArgs([{ ...base, type: 'network' }])).toThrow(/one of/);
    expect(() => parsePrinterConfigArgs([{ ...base, paperWidth: 100 }])).toThrow(/paperWidth/);
  });

  it('rejects an invalid retry count', () => {
    expect(() => parsePrinterConfigArgs([{ ...base, retries: 999 }])).toThrow(/retries/);
  });

  it('rejects an oversized device path', () => {
    expect(() => parsePrinterConfigArgs([{ ...base, devicePath: 'x'.repeat(400) }])).toThrow(
      /devicePath/,
    );
  });
});

describe('file dialog and offline queue validation', () => {
  it('validates dialog filters', () => {
    expect(
      parseFileFiltersArgs([[{ name: 'Backups', extensions: ['json'] }]]),
    ).toEqual([{ name: 'Backups', extensions: ['json'] }]);

    expect(() => parseFileFiltersArgs([[{ name: 'Bad', extensions: ['../etc'] }]])).toThrow(
      IpcValidationError,
    );
    expect(() => parseFileFiltersArgs([{}])).toThrow(/expected array/);
  });

  it('accepts no filters', () => {
    expect(parseFileFiltersArgs([])).toEqual([]);
  });

  it('validates an offline sale record', () => {
    const record = {
      id: 'sale-1',
      idempotency_key: 'key-1',
      payload: { total: 10 },
      saleData: { total: 10 },
      timestamp: new Date().toISOString(),
    };

    expect(parseOfflineSaleArgs([record]).id).toBe('sale-1');
    expect(() => parseOfflineSaleArgs([{ ...record, id: '' }])).toThrow(IpcValidationError);
    expect(() => parseOfflineSaleArgs([{ ...record, payload: 'json-string' }])).toThrow(
      /payload/,
    );
    expect(() => parseOfflineSaleArgs([{ ...record, idempotency_key: undefined }])).toThrow(
      /idempotency_key/,
    );
  });

  it('validates offline sale ids', () => {
    expect(parseOfflineSaleIdArgs(['sale-1'])).toBe('sale-1');
    expect(() => parseOfflineSaleIdArgs([42])).toThrow(/expected string/);
  });
});

describe('sender guard', () => {
  const window = { webContents: { id: 7, isDestroyed: () => false } } as unknown as {
    webContents: WebContents;
  };

  const guard = createSenderGuard({
    getWindow: () => window,
    allowedUrlPrefixes: ['file://'],
  });

  const makeEvent = (overrides: Record<string, unknown> = {}) =>
    ({
      sender: { id: 7 },
      senderFrame: { url: 'file:///app/index.html', parent: null },
      ...overrides,
    }) as never;

  it('accepts the trusted top-level frame', () => {
    expect(() => guard(makeEvent())).not.toThrow();
  });

  it('rejects another window', () => {
    expect(() => guard(makeEvent({ sender: { id: 99 } }))).toThrow(IpcSecurityError);
  });

  it('rejects an iframe', () => {
    expect(() =>
      guard(makeEvent({ senderFrame: { url: 'file:///app/index.html', parent: {} } })),
    ).toThrow(/sub-frames/);
  });

  it('rejects an untrusted origin', () => {
    expect(() =>
      guard(makeEvent({ senderFrame: { url: 'https://evil.example/', parent: null } })),
    ).toThrow(/untrusted origin/);
  });

  it('rejects when there is no frame', () => {
    expect(() => guard(makeEvent({ senderFrame: null }))).toThrow(/unknown sender frame/);
  });
});

});
