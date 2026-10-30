import { afterEach, expect, it, vi } from 'vitest';
import { printerService } from '../printer.service';
import { useLANStore, type OfflineSale } from '../../stores/useLANStore';
afterEach(() => { delete window.electronAPI; vi.restoreAllMocks(); });
it('does not bypass an Electron authorization denial through browser printing', async () => {
  window.electronAPI = { enqueuePrintJob: vi.fn().mockRejectedValue(new Error('Denied')) } as never;
  const create = vi.spyOn(document, 'createElement');
  await expect(printerService.printReceipt({ receipt_number: 'TEST', items: [], total: 0 })).rejects.toThrow('Denied');
  expect(create).not.toHaveBeenCalled();
});
it('retains sales for recovery when durable authorization/persistence fails', async () => {
  window.electronAPI = { persistOfflineSale: vi.fn().mockRejectedValue(new Error('Lease expired')), removeOfflineSale: vi.fn().mockRejectedValue(new Error('Not acknowledged')) } as never;
  useLANStore.setState({ offlineSales: [] });
  const sale = { id: 'synthetic' } as OfflineSale;
  await expect(useLANStore.getState().addOfflineSale(sale)).rejects.toThrow('Lease expired');
  expect(useLANStore.getState().offlineSales).toHaveLength(0);
  useLANStore.setState({ offlineSales: [sale] });
  await expect(useLANStore.getState().removeOfflineSale(sale.id)).rejects.toThrow('Not acknowledged');
  expect(useLANStore.getState().offlineSales).toHaveLength(1);
});
