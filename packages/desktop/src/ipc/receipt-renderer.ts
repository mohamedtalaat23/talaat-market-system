import type { Receipt, ReceiptItem } from './printing-types';

export class ReceiptRenderer {
  /**
   * Helper to pad a string on the left to match a specific length.
   */
  private static padLeft(str: string, len: number): string {
    if (str.length >= len) return str.substring(0, len);
    return ' '.repeat(len - str.length) + str;
  }

  /**
   * Helper to center a string within a given line width.
   */
  private static centerText(str: string, width: number): string {
    if (str.length >= width) return str.substring(0, width);
    const leftPad = Math.floor((width - str.length) / 2);
    const rightPad = width - str.length - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  }

  /**
   * Helper to split key and value text to opposite edges.
   */
  private static splitKeyValue(key: string, val: string, width: number): string {
    const spaceCount = width - key.length - val.length;
    if (spaceCount <= 0) {
      return (key + ' ' + val).substring(0, width);
    }
    return key + ' '.repeat(spaceCount) + val;
  }

  /**
   * Render a divider line.
   */
  private static getDivider(width: number): string {
    return '-'.repeat(width);
  }

  /**
   * Transforms a Receipt model into an array of print-ready text lines.
   */
  public static render(receipt: Receipt, paperWidth: 58 | 80): string[] {
    // 58mm thermal printers usually fit 32 chars. 80mm printers fit 48 chars.
    const width = paperWidth === 58 ? 32 : 48;
    const lines: string[] = [];

    // 1. Header (Store info)
    lines.push(this.centerText(receipt.storeName, width));
    if (receipt.storeAddress) {
      lines.push(this.centerText(receipt.storeAddress, width));
    }
    if (receipt.storePhone) {
      lines.push(this.centerText(`Tel: ${receipt.storePhone}`, width));
    }

    lines.push(this.getDivider(width));

    // Reprint Warning
    if (receipt.isReprint || (receipt.printCount && receipt.printCount > 0)) {
      const count = receipt.printCount || 1;
      lines.push(this.centerText(`*** REPRINT #${count} ***`, width));
      lines.push(this.getDivider(width));
    }

    // 2. Metadata (Receipt #, Date, Cashier)
    lines.push(`Receipt: ${receipt.receiptNumber}`);
    lines.push(`Date:    ${receipt.timestamp}`);
    lines.push(`Cashier: ${receipt.cashierName}`);
    lines.push(this.getDivider(width));

    // 3. Items list
    lines.push(this.splitKeyValue('ITEMS', 'TOTAL (EGP)', width));
    lines.push(this.getDivider(width));

    receipt.items.forEach((item: ReceiptItem) => {
      // Line 1: English name + Unit
      const itemTitle = `${item.name} (${item.unit})`;
      lines.push(itemTitle);

      // Line 2: Arabic name (if provided)
      if (item.name_ar) {
        lines.push(`  ${item.name_ar}`);
      }

      // Line 3: Quantities & Line Total
      const qtyStr = `${item.quantity.toFixed(2)} x ${item.unitPrice.toFixed(2)}`;
      const totalStr = item.lineTotal.toFixed(2);

      lines.push(this.splitKeyValue(`  ${qtyStr}`, totalStr, width));

      // Line 4: Item-level discount (if provided)
      if (item.discount > 0) {
        lines.push(this.padLeft(`(Discount: -${item.discount.toFixed(2)})`, width));
      }
    });

    lines.push(this.getDivider(width));

    // 4. Totals & Payment Summary
    lines.push(this.splitKeyValue('Subtotal:', `${receipt.totals.subtotal.toFixed(2)} EGP`, width));

    const disc = receipt.totals.discount + (receipt.totals.globalDiscount || 0);
    if (disc > 0) {
      lines.push(this.splitKeyValue('Discount:', `-${disc.toFixed(2)} EGP`, width));
    }

    if (receipt.totals.tax > 0) {
      lines.push(this.splitKeyValue('Tax:', `${receipt.totals.tax.toFixed(2)} EGP`, width));
    }

    lines.push(this.getDivider(width));

    // Bold total (handled in ESC/POS formatting layer, here we just output text)
    lines.push(this.splitKeyValue('TOTAL:', `${receipt.totals.total.toFixed(2)} EGP`, width));

    lines.push(this.getDivider(width));

    // Payment details
    lines.push(this.splitKeyValue('Payment Method:', receipt.paymentMethod.toUpperCase(), width));

    if (receipt.totals.cashReceived !== undefined && receipt.totals.cashReceived !== null) {
      lines.push(
        this.splitKeyValue(
          'Cash Received:',
          `${receipt.totals.cashReceived.toFixed(2)} EGP`,
          width,
        ),
      );
    }

    if (receipt.totals.changeGiven !== undefined && receipt.totals.changeGiven !== null) {
      lines.push(
        this.splitKeyValue('Change Due:', `${receipt.totals.changeGiven.toFixed(2)} EGP`, width),
      );
    }

    lines.push(this.getDivider(width));

    // 5. Friendly Footer (Centered)
    lines.push(this.centerText('Thank you for shopping!', width));
    lines.push(this.centerText('شكراً لزيارتكم', width));

    return lines;
  }
}
