/**
 * SyncService — Offline Queue Flush Orchestrator
 *
 * Extracted from LANSyncManager.tsx to separate business logic from
 * React component lifecycle. Benefits:
 *   - No race condition: a single boolean lock covers both sale and
 *     shift-closure flushes (they share the same guard).
 *   - Component-lifecycle independent: the service object is a module
 *     singleton, not tied to a React component's mount/unmount.
 *   - Testable: can be imported and called in unit tests without
 *     mounting a React component tree.
 *
 * The LANSyncManager component now only reads reactive store state
 * for UI rendering and calls SyncService.tryFlush() on status changes.
 */

import toast from 'react-hot-toast';
import { apiClient } from '@/services/api-client';
import { useLANStore } from '../stores/useLANStore';

/** Module-level lock: prevents concurrent sales + closure flushes */
let isFlushInProgress = false;

/**
 * Attempt to flush both offline sales and shift closures to the master server.
 * Safe to call repeatedly — it self-guards against concurrent execution.
 *
 * Returns true if any data was flushed, false if flush was skipped/failed.
 */
async function tryFlush(): Promise<boolean> {
  const {
    status,
    offlineSales,
    offlineShiftClosures,
    removeOfflineSale,
    removeOfflineShiftClosure,
  } = useLANStore.getState();

  // Only flush when online and not already running
  if (status !== 'online' || isFlushInProgress) {
    return false;
  }

  const hasSales = offlineSales.length > 0;
  const hasClosures = offlineShiftClosures.length > 0;

  if (!hasSales && !hasClosures) {
    return false;
  }

  isFlushInProgress = true;
  let flushedAnything = false;

  // ── 1. Flush offline checkout transactions ─────────────────────────────────
  if (hasSales) {
    const salesToFlush = [...offlineSales];
    const toastId = toast.loading(
      `Synchronizing ${salesToFlush.length} offline checkout(s) to Master...`,
      { position: 'top-right' },
    );

    try {
      const response = await apiClient.post('/pos/sync', {
        transactions: salesToFlush.map((s) => s.payload),
      });

      if (response.data?.success) {
        const syncedIds: string[] = response.data.syncedIds || [];
        const failed: { id: string; error: string }[] = response.data.failed || [];
        const syncedSet = new Set(syncedIds);

        for (const sale of salesToFlush) {
          if (syncedSet.has(sale.id) || syncedSet.has(sale.payload.idempotency_key)) {
            removeOfflineSale(sale.id);
          }
        }

        if (failed.length > 0 && syncedIds.length > 0) {
          toast.error(`${syncedIds.length} synced, ${failed.length} failed. Check server logs.`, {
            id: toastId,
            icon: '⚠️',
            duration: 6000,
          });
        } else if (failed.length > 0) {
          toast.error(`${failed.length} transaction(s) failed to sync. Will retry.`, {
            id: toastId,
            icon: '⚠️',
            duration: 5000,
          });
        } else {
          toast.success(`Successfully synchronized ${syncedIds.length} transaction(s) to Master.`, {
            id: toastId,
            icon: '✅',
            duration: 4000,
          });
          flushedAnything = true;
        }
      } else {
        toast.error('Offline synchronization failed.', { id: toastId, icon: '⚠️', duration: 5000 });
      }
    } catch (err: any) {
      console.error('[SyncService] Failed to flush offline sales:', err);
      toast.error(
        err.response?.data?.message || 'Sync failed. Will retry when connection stabilizes.',
        {
          id: toastId,
          icon: '⚠️',
          duration: 5000,
        },
      );
    }
  }

  // ── 2. Flush offline shift closures ────────────────────────────────────────
  if (hasClosures) {
    const closuresToFlush = [...offlineShiftClosures];
    const toastId = toast.loading('Synchronizing shift closure(s) to Master...', {
      position: 'top-right',
    });

    let successfulSyncs = 0;

    for (const closure of closuresToFlush) {
      try {
        // 500ms throttle to pace sequential network requests
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        await apiClient.post('/pos/shifts/close', closure.payload);
        removeOfflineShiftClosure(closure.id);
        successfulSyncs++;
      } catch (err: any) {
        console.error(`[SyncService] Failed to sync shift closure ${closure.id}:`, err);
        // Abort remaining closures on a network-level failure;
        // server-level errors (4xx) are logged but do not abort.
        if (err.message?.includes('Network Error') || err.status === undefined) {
          break;
        }
      }
    }

    toast.dismiss(toastId);

    if (successfulSyncs > 0) {
      toast.success('Successfully synchronized shift closures to Master.', {
        icon: '🔒',
        duration: 3000,
      });
      flushedAnything = true;
    }
  }

  isFlushInProgress = false;
  return flushedAnything;
}

/** Expose the public API of the service */
export const SyncService = {
  tryFlush,
  get isFlushing() {
    return isFlushInProgress;
  },
};
