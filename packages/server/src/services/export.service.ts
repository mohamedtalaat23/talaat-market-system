import { reportsRepository } from '../repositories/reports.repository';
import { NotFoundError } from '../middleware/errorHandler';

export class ExportService {
  /**
   * Export Shift Reconciliation summary report as CSV format.
   */
  async exportShiftReportCSV(shiftId: string): Promise<{ filename: string; content: string }> {
    const shiftData = await reportsRepository.getShiftDetail(Number(shiftId));
    if (!shiftData || !shiftData.shift) {
      throw new NotFoundError('Shift report', shiftId);
    }
    const shift = shiftData.shift;

    const escape = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push('Talaat Market System — Shift Reconciliation Report');
    lines.push(`Shift ID,${escape(shift.id)}`);
    lines.push(`Cashier,${escape(shift.cashier_name || 'N/A')}`);
    lines.push(`Register,${escape(shift.register_name || 'Main Register')}`);
    lines.push(`Opened At,${escape(shift.start_time)}`);
    lines.push(`Closed At,${escape(shift.end_time || 'Open')}`);
    lines.push('');
    lines.push('Metric,Amount (EGP)');
    lines.push(`Starting Cash,${Number(shift.starting_cash || 0).toFixed(2)}`);
    lines.push(`Gross Sales,${Number(shiftData.summary.total_revenue || 0).toFixed(2)}`);
    lines.push(`Expected Ending Cash,${Number(shift.expected_cash || 0).toFixed(2)}`);
    lines.push(`Actual Physical Cash,${Number(shift.ending_cash || 0).toFixed(2)}`);
    lines.push(`Cash Variance,${Number(shift.variance || 0).toFixed(2)}`);

    const filename = `Shift_Report_${shiftId}_${new Date().toISOString().split('T')[0]}.csv`;
    return { filename, content: lines.join('\n') };
  }
}

export const exportService = new ExportService();
