import { PrinterPayload, generateReceiptHtml } from './receipt-template';

export class PrinterService {
  /**
   * Primary entry point to print a receipt
   */
  public async printReceipt(sale: any, isReprint: boolean = false): Promise<{ success: boolean }> {
    // 1. Construct standard receipt domain model
    const receipt: any = {
      receiptNumber: sale.receipt_number || 'STR01-REG01-UNKNOWN',
      cashierName: sale.cashier_name || 'Cashier',
      storeName: 'TALAAT MARKET',
      storeAddress: 'Cairo, Egypt',
      storePhone: '01012345678',
      items: (sale.items || []).map((item: any) => ({
        name: item.product_name || item.name || 'Item',
        name_ar: item.name_ar || null,
        barcode: item.barcode || null,
        quantity: Number(item.quantity || 1),
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unit_price || 0),
        discount: Number(item.discount || 0),
        lineTotal: Number(item.line_total || 0),
      })),
      totals: {
        subtotal: Number(sale.subtotal || sale.total || 0),
        discount: Number(sale.discount_amount || 0),
        globalDiscount: Number(sale.global_discount || 0),
        tax: Number(sale.tax_amount || 0),
        total: Number(sale.total || 0),
        cashReceived:
          sale.cash_received !== undefined && sale.cash_received !== null
            ? Number(sale.cash_received)
            : null,
        changeGiven:
          sale.change_given !== undefined && sale.change_given !== null
            ? Number(sale.change_given)
            : null,
      },
      timestamp: sale.created_at
        ? new Date(sale.created_at).toLocaleString()
        : new Date().toLocaleString(),
      paymentMethod: sale.payment_method || 'cash',
      printCount: sale.print_count || 0,
      isReprint,
    };

    // Try Electron Hardware Queue printing first
    if (window.electronAPI?.enqueuePrintJob) {
      try {
        await window.electronAPI.enqueuePrintJob(receipt);
        return { success: true };
      } catch (error) {
        console.error('Electron hardware queue print failed, falling back to browser HTML', error);
      }
    }

    // Fallback: Pre-render HTML
    const payload: PrinterPayload = {
      receipt_number: sale.receipt_number,
      total: sale.total,
      cash_received: sale.cash_received,
      change_given: sale.change_given,
      payment_method: sale.payment_method,
      isReprint,
      items: sale.items || [],
    };

    const html = generateReceiptHtml(payload);

    // Fallback: Browser hidden iframe
    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        iframe.id = 'pos-printer-frame';

        // Remove old iframe if it exists
        const oldIframe = document.getElementById('pos-printer-frame');
        if (oldIframe) {
          document.body.removeChild(oldIframe);
        }

        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
          throw new Error('Could not access iframe document');
        }

        doc.open();
        doc.write(html);
        doc.close();

        const runLater = setTimeout;
        // Wait for styles/images to load then print
        iframe.onload = () => {
          runLater(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            resolve({ success: true });
          }, 500); // Small buffer for rendering
        };
      } catch (err) {
        console.error('Browser print fallback failed', err);
        reject(err);
      }
    });
  }
}

export const printerService = new PrinterService();
