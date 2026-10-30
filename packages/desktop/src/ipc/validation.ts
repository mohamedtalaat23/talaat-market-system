import type { IpcMainInvokeEvent, WebContents } from 'electron';
import type { PrinterConfig, Receipt, ReceiptItem } from './printing-types';

/**
 * Runtime validation for every IPC payload, plus sender verification.
 *
 * The renderer is treated as untrusted: a compromised page (or a stray
 * `window.open`/injected script) must not be able to hand the main process
 * arbitrary objects. Every handler parses its arguments through one of the
 * parsers below and rejects anything malformed *before* touching the printer,
 * the filesystem or the durable offline store.
 *
 * Deliberately dependency-free: the desktop package has no schema library, and a
 * small, explicit validator is easier to audit than a generic one.
 */

export class IpcValidationError extends Error {
  public code = 'INVALID_IPC_PAYLOAD';

  constructor(channel: string, path: string, expected: string, received: unknown) {
    super(
      `IPC ${channel}: invalid argument at "${path}" — expected ${expected}, received ${describe(received)}.`,
    );
    this.name = 'IpcValidationError';
  }
}

export class IpcSecurityError extends Error {
  public code = 'UNTRUSTED_IPC_SENDER';

  constructor(message: string) {
    super(message);
    this.name = 'IpcSecurityError';
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ── Primitive parsers ────────────────────────────────────────────────────────

function str(
  value: unknown,
  channel: string,
  path: string,
  options: { min?: number; max?: number; pattern?: RegExp } = {},
): string {
  if (typeof value !== 'string') throw new IpcValidationError(channel, path, 'string', value);

  const min = options.min ?? 0;
  const max = options.max ?? 10_000;

  if (value.length < min) {
    throw new IpcValidationError(channel, path, `string with at least ${min} characters`, value);
  }
  if (value.length > max) {
    throw new IpcValidationError(channel, path, `string with at most ${max} characters`, value);
  }
  if (options.pattern && !options.pattern.test(value)) {
    throw new IpcValidationError(channel, path, `string matching ${options.pattern}`, value);
  }

  return value;
}

function num(
  value: unknown,
  channel: string,
  path: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IpcValidationError(channel, path, 'finite number', value);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new IpcValidationError(channel, path, 'integer', value);
  }
  if (options.min !== undefined && value < options.min) {
    throw new IpcValidationError(channel, path, `number >= ${options.min}`, value);
  }
  if (options.max !== undefined && value > options.max) {
    throw new IpcValidationError(channel, path, `number <= ${options.max}`, value);
  }
  return value;
}

function obj(value: unknown, channel: string, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new IpcValidationError(channel, path, 'object', value);
  return value;
}

function arr(
  value: unknown,
  channel: string,
  path: string,
  options: { max: number; min?: number },
): unknown[] {
  if (!Array.isArray(value)) throw new IpcValidationError(channel, path, 'array', value);
  if (value.length > options.max) {
    throw new IpcValidationError(channel, path, `array with at most ${options.max} items`, value);
  }
  if (options.min !== undefined && value.length < options.min) {
    throw new IpcValidationError(channel, path, `array with at least ${options.min} items`, value);
  }
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  channel: string,
  path: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new IpcValidationError(channel, path, `one of ${allowed.join(' | ')}`, value);
  }
  return value as T;
}

// ── Sender verification ──────────────────────────────────────────────────────

export interface SenderGuardOptions {
  /** The single window allowed to talk to the main process. */
  getWindow: () => { webContents: WebContents } | null;
  /** URL prefixes considered part of the application (dev server / file://). */
  allowedUrlPrefixes: string[];
}

/**
 * Returns a guard that throws unless the invocation comes from the main window's
 * top-level frame on an application URL.
 *
 * This blocks a second window, an iframe, an embedded webview or a renderer that
 * navigated away from the app from reaching privileged handlers.
 */
export function createSenderGuard(options: SenderGuardOptions) {
  return (event: IpcMainInvokeEvent): void => {
    const window = options.getWindow();

    if (!window || window.webContents.isDestroyed() || event.sender.id !== window.webContents.id) {
      throw new IpcSecurityError('IPC rejected: sender is not the application window.');
    }

    const frame = event.senderFrame;
    if (!frame) {
      throw new IpcSecurityError('IPC rejected: unknown sender frame.');
    }
    if (frame.parent !== null) {
      throw new IpcSecurityError('IPC rejected: sub-frames may not invoke the main process.');
    }
    if (!options.allowedUrlPrefixes.some((prefix) => frame.url.startsWith(prefix))) {
      throw new IpcSecurityError('IPC rejected: request came from an untrusted origin.');
    }
  };
}

// ── Argument parsers ─────────────────────────────────────────────────────────

const MAX_HTML_BYTES = 512 * 1024;
const MAX_ITEMS = 500;

function parseReceiptItem(value: unknown, channel: string, path: string): ReceiptItem {
  const record = obj(value, channel, path);

  return {
    name: str(record['name'], channel, `${path}.name`, { min: 1, max: 200 }),
    name_ar:
      typeof record['name_ar'] === 'string'
        ? str(record['name_ar'], channel, `${path}.name_ar`, { max: 200 })
        : null,
    barcode:
      typeof record['barcode'] === 'string'
        ? str(record['barcode'], channel, `${path}.barcode`, { max: 100 })
        : null,
    quantity: num(record['quantity'], channel, `${path}.quantity`, { min: 0, max: 1_000_000 }),
    unit: str(record['unit'], channel, `${path}.unit`, { min: 1, max: 50 }),
    unitPrice: num(record['unitPrice'], channel, `${path}.unitPrice`, {
      min: 0,
      max: 10_000_000,
    }),
    discount: num(record['discount'], channel, `${path}.discount`, { min: 0, max: 10_000_000 }),
    lineTotal: num(record['lineTotal'], channel, `${path}.lineTotal`, {
      min: 0,
      max: 10_000_000,
    }),
  };
}

/** Validates a `printer:print-receipt` payload (pre-rendered HTML). */
export function parsePrintReceiptArgs(args: unknown[]): { html: string } {
  const channel = 'printer:print-receipt';
  const first = obj(args[0], channel, 'args[0]');
  const html = str(first['html'], channel, 'html', { min: 1, max: MAX_HTML_BYTES });

  if (!/^<!?doctype|^<html|^<div|^<body/i.test(html.trim())) {
    throw new IpcValidationError(channel, 'html', 'an HTML document', html.slice(0, 16));
  }

  return { html };
}

/** Validates the ESC/POS print job payload. */
export function parseReceiptArgs(args: unknown[]): Receipt {
  const channel = 'printer:enqueue-job';
  const record = obj(args[0], channel, 'args[0]');
  const totals = obj(record['totals'], channel, 'totals');

  const items = arr(record['items'], channel, 'items', { min: 1, max: MAX_ITEMS }).map(
    (item, index) => parseReceiptItem(item, channel, `items[${index}]`),
  );

  return {
    receiptNumber: str(record['receiptNumber'], channel, 'receiptNumber', { min: 1, max: 100 }),
    cashierName: str(record['cashierName'], channel, 'cashierName', { min: 1, max: 150 }),
    storeName: str(record['storeName'], channel, 'storeName', { min: 1, max: 150 }),
    storeAddress: str(record['storeAddress'] ?? '', channel, 'storeAddress', { max: 300 }),
    storePhone: str(record['storePhone'] ?? '', channel, 'storePhone', { max: 50 }),
    items,
    totals: {
      subtotal: num(totals['subtotal'], channel, 'totals.subtotal', { min: 0 }),
      discount: num(totals['discount'], channel, 'totals.discount', { min: 0 }),
      globalDiscount:
        typeof totals['globalDiscount'] === 'number'
          ? num(totals['globalDiscount'], channel, 'totals.globalDiscount', { min: 0 })
          : 0,
      tax: num(totals['tax'], channel, 'totals.tax', { min: 0 }),
      total: num(totals['total'], channel, 'totals.total', { min: 0 }),
      cashReceived:
        typeof totals['cashReceived'] === 'number'
          ? num(totals['cashReceived'], channel, 'totals.cashReceived', { min: 0 })
          : null,
      changeGiven:
        typeof totals['changeGiven'] === 'number'
          ? num(totals['changeGiven'], channel, 'totals.changeGiven', { min: 0 })
          : null,
    },
    timestamp: str(record['timestamp'], channel, 'timestamp', { min: 1, max: 60 }),
    ...(typeof record['printCount'] === 'number'
      ? {
          printCount: num(record['printCount'], channel, 'printCount', { min: 0, integer: true }),
        }
      : {}),
    paymentMethod: str(record['paymentMethod'], channel, 'paymentMethod', { min: 1, max: 30 }),
    ...(typeof record['isReprint'] === 'boolean' ? { isReprint: record['isReprint'] } : {}),
  };
}

/** Validates a print-job id argument. */
export function parseJobIdArgs(args: unknown[]): string {
  return str(args[0], 'printer:retry-job', 'args[0]', { min: 1, max: 100 });
}

/** Validates the printer configuration object. */
export function parsePrinterConfigArgs(args: unknown[]): PrinterConfig {
  const channel = 'printer:update-config';
  const record = obj(args[0], channel, 'args[0]');
  const paperWidth = num(record['paperWidth'] ?? 58, channel, 'paperWidth', {
    min: 58,
    max: 80,
    integer: true,
  });

  if (paperWidth !== 58 && paperWidth !== 80) {
    throw new IpcValidationError(channel, 'paperWidth', '58 or 80', paperWidth);
  }

  const devicePath = str(record['devicePath'] ?? '', channel, 'devicePath', { max: 300 });
  if (
    record['type'] === 'usb' &&
    !(
      /^(?:\\\\[.]\\)?(?:COM|LPT)[1-9][0-9]*$/i.test(devicePath) ||
      /^\/dev\/usb\/lp[0-9]+$/.test(devicePath)
    )
  ) {
    throw new IpcValidationError(
      channel,
      'devicePath',
      'a COM/LPT or /dev/usb/lp device',
      devicePath,
    );
  }
  return {
    type: oneOf(record['type'], channel, 'type', ['mock', 'usb', 'system'] as const),
    paperWidth,
    devicePath,
    ...(typeof record['deviceName'] === 'string'
      ? { deviceName: str(record['deviceName'], channel, 'deviceName', { max: 200 }) }
      : {}),
    autoPrint: typeof record['autoPrint'] === 'boolean' ? record['autoPrint'] : true,
    retries:
      typeof record['retries'] === 'number'
        ? num(record['retries'], channel, 'retries', { min: 0, max: 20, integer: true })
        : 3,
  };
}

/** Validates file-dialog filters. */
export function parseFileFiltersArgs(args: unknown[]): { name: string; extensions: string[] }[] {
  const channel = 'dialog:select-file';
  if (args[0] === undefined) return [];

  return arr(args[0], channel, 'args[0]', { max: 10 }).map((filter, index) => {
    const record = obj(filter, channel, `filters[${index}]`);
    return {
      name: str(record['name'], channel, `filters[${index}].name`, { min: 1, max: 60 }),
      extensions: arr(record['extensions'], channel, `filters[${index}].extensions`, {
        max: 20,
        min: 1,
      }).map((extension, extIndex) =>
        str(extension, channel, `filters[${index}].extensions[${extIndex}]`, {
          min: 1,
          max: 20,
          pattern: /^[a-zA-Z0-9*]+$/,
        }),
      ),
    };
  });
}

export interface OfflineSaleRecord {
  id: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  saleData: Record<string, unknown>;
  timestamp: string;
}

/** Validates the durable offline-sale record stored by the renderer. */
export function parseOfflineSaleArgs(args: unknown[]): OfflineSaleRecord {
  const channel = 'offline:persist-sale';
  const record = obj(args[0], channel, 'args[0]');

  return {
    id: str(record['id'], channel, 'id', { min: 1, max: 100 }),
    idempotency_key: str(record['idempotency_key'], channel, 'idempotency_key', {
      min: 1,
      max: 100,
    }),
    payload: obj(record['payload'], channel, 'payload'),
    saleData: obj(record['saleData'], channel, 'saleData'),
    timestamp: str(record['timestamp'], channel, 'timestamp', { min: 1, max: 60 }),
  };
}

/** Validates the offline-sale id argument. */
export function parseOfflineSaleIdArgs(args: unknown[]): string {
  return str(args[0], 'offline:remove-sale', 'args[0]', { min: 1, max: 100 });
}
