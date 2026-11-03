import { beforeEach, expect, it, vi } from 'vitest';
import { SyncService } from '../SyncService';
import { apiClient } from '@/services/api-client';
import { useLANStore } from '../../stores/useLANStore';
vi.mock('@/services/api-client', () => ({ apiClient: { post: vi.fn() } }));
vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(), error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));
vi.mock('../../stores/useLANStore', () => ({ useLANStore: { getState: vi.fn() } }));
const remove = vi.fn();
const setSyncing = vi.fn();
const setIssues = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLANStore.getState).mockReturnValue({
    status: 'online',
    offlineSales: [{ id: 'local-1', payload: { idempotency_key: 'key-1' } }],
    offlineShiftClosures: [],
    removeOfflineSale: remove,
    removeOfflineShiftClosure: vi.fn(),
    setSyncing,
    setSyncIssues: setIssues,
  } as unknown as ReturnType<typeof useLANStore.getState>);
});
it('removes an entry only after a server reconciliation acknowledgement', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { success: true, syncedIds: [], reconciledIds: ['key-1'], failed: [] },
  });
  await SyncService.tryFlush();
  expect(remove).toHaveBeenCalledWith('local-1');
  expect(setSyncing).toHaveBeenLastCalledWith(false);
});
it('retains rejected entries and exposes their required reconciliation', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    data: {
      success: true,
      syncedIds: [],
      failed: [{ id: 'key-1', code: 'OFFLINE_REJECTED', error: 'Rejected' }],
    },
  });
  await SyncService.tryFlush();
  expect(remove).not.toHaveBeenCalled();
  expect(setIssues).toHaveBeenCalledWith({ 'key-1': 'rejected' });
});
it('retains durable evidence after network or local removal failure and releases the retry lock', async () => {
  vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network unavailable'));
  await SyncService.tryFlush();
  expect(remove).not.toHaveBeenCalled();
  expect(SyncService.isFlushing).toBe(false);
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { success: true, syncedIds: ['key-1'], failed: [] },
  });
  remove.mockRejectedValueOnce(new Error('Storage unavailable'));
  await SyncService.tryFlush();
  expect(SyncService.isFlushing).toBe(false);
  expect(setSyncing).toHaveBeenLastCalledWith(false);
});
