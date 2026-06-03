export interface ReceiptItem {
  name: string;
  name_ar?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface ReceiptTotals {
  subtotal: number;
  discount: number;
  globalDiscount?: number;
  tax: number;
  total: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
}

export interface Receipt {
  receiptNumber: string;
  cashierName: string;
  storeName: string;
  storeAddress?: string | null;
  storePhone?: string | null;
  items: ReceiptItem[];
  totals: ReceiptTotals;
  timestamp: string;
  printCount?: number;
  paymentMethod: string;
  isReprint?: boolean;
}

export interface PrinterConfig {
  type: 'mock' | 'usb' | 'system';
  paperWidth: 58 | 80;
  devicePath: string;
  deviceName?: string;
  autoPrint: boolean;
  retries: number;
}

export interface PrintJob {
  id: string;
  receipt: Receipt;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  attempts: number;
  error?: string | null;
  createdAt: string;
}

export interface PrinterStatus {
  online: boolean;
  message: string;
}
