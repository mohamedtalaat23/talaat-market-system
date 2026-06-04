export interface PrinterPayload {
  receipt_number: string;
  total: number;
  cash_received?: number;
  change_given?: number;
  payment_method: string;
  isReprint?: boolean;
  items: Array<{
    product_name: string;
    name_ar?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

export function generateReceiptHtml(data: PrinterPayload): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt ${data.receipt_number}</title>
      <style>
        @page { margin: 0; }
        body { 
          font-family: 'Courier New', monospace, sans-serif; 
          width: 72mm; /* Printable width of 80mm paper */
          margin: 0 auto; 
          padding: 5mm; 
          color: black; 
          background: white; 
          font-size: 12px; 
          line-height: 1.2;
        }
        .text-center { text-align: center; }
        .flex-between { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .divider { border-bottom: 1px dashed black; margin: 8px 0; }
        .reprint-watermark {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          border: 1px solid black;
          padding: 4px;
          margin: 8px 0;
          letter-spacing: 2px;
        }
        .qr-placeholder {
          width: 100px;
          height: 100px;
          border: 1px solid #ccc;
          margin: 10px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="text-center bold" style="font-size: 16px;">TALAAT MARKET</div>
      <div class="text-center">Receipt: ${data.receipt_number}</div>
      <div class="text-center" style="font-size: 10px;">${new Date().toLocaleString()}</div>
      
      ${data.isReprint ? '<div class="reprint-watermark">*** REPRINT COPY ***</div>' : ''}
      
      <div class="divider"></div>
      ${data.items
        .map(
          (i) => `
        <div dir="auto">${i.product_name} ${i.name_ar ? '(' + i.name_ar + ')' : ''}</div>
        <div class="flex-between">
          <span>${i.quantity}x ${Number(i.unit_price).toFixed(2)}</span>
          <span>${Number(i.line_total).toFixed(2)}</span>
        </div>
      `,
        )
        .join('')}
      <div class="divider"></div>
      
      <div class="flex-between bold" style="font-size: 14px;">
        <span>TOTAL</span>
        <span>EGP ${Number(data.total).toFixed(2)}</span>
      </div>
      
      <div class="flex-between" style="margin-top: 4px;">
        <span>Paid (${data.payment_method || 'cash'})</span>
        <span>EGP ${Number(data.cash_received || data.total).toFixed(2)}</span>
      </div>
      <div class="flex-between">
        <span>Change</span>
        <span>EGP ${Number(data.change_given || 0).toFixed(2)}</span>
      </div>

      <div class="divider"></div>
      <div class="text-center" style="font-size: 10px;">Thank you for your visit!</div>
      
      <!-- QR Placeholder -->
      <div class="qr-placeholder">QR Code<br/>Placeholder</div>
    </body>
    </html>
  `;
}
