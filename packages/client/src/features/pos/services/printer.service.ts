import { PrinterPayload, generateReceiptHtml } from './receipt-template';

export class PrinterService {
  /**
   * Primary entry point to print a receipt
   */
  public async printReceipt(sale: any, isReprint: boolean = false): Promise<{ success: boolean }> {
    const payload: PrinterPayload = {
      receipt_number: sale.receipt_number,
      total: sale.total,
      cash_received: sale.cash_received,
      change_given: sale.change_given,
      payment_method: sale.payment_method,
      isReprint,
      items: sale.items || []
    };

    const html = generateReceiptHtml(payload);

    // Try Electron Native first
    if (window.electronAPI?.printReceipt) {
      try {
        await window.electronAPI.printReceipt({ html });
        return { success: true };
      } catch (error) {
        console.error('Electron print failed, falling back to browser', error);
      }
    }

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

        // Wait for styles/images to load then print
        iframe.onload = () => {
          setTimeout(() => {
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
