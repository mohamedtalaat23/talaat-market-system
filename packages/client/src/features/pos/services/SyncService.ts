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
  useLANStore.getState().setSyncing(true);
  const ar = localStorage.getItem('talaat_lang') === 'ar';
  try {
    let flushedAnything = false;

    // ── 1. Flush offline checkout transactions ─────────────────────────────────
    if (hasSales) {
      const salesToFlush = [...offlineSales];
      const toastId = toast.loading(
        ar
          ? `جارٍ مزامنة ${salesToFlush.length} عملية…`
          : `Synchronizing ${salesToFlush.length} offline sale(s)…`,
        { position: 'top-right' },
      );

      try {
        const response = await apiClient.post('/pos/sync', {
          transactions: salesToFlush.map((s) => s.payload),
        });

        if (response.data?.success) {
          const syncedIds: string[] = response.data.syncedIds || [];
          const failed: { id: string; error: string; code?: string; quarantined?: boolean }[] =
            response.data.failed || [];
          const reconciledIds: string[] = response.data.reconciledIds || [];
          const syncedSet = new Set([...syncedIds, ...reconciledIds]);

          for (const sale of salesToFlush) {
            if (syncedSet.has(sale.id) || syncedSet.has(sale.payload.idempotency_key)) {
              await removeOfflineSale(sale.id);
            }
          }

          useLANStore
            .getState()
            .setSyncIssues(
              Object.fromEntries(
                failed.map((entry) => [
                  entry.id,
                  entry.code === 'OFFLINE_REJECTED'
                    ? 'rejected'
                    : entry.quarantined
                      ? 'review'
                      : 'retry',
                ]),
              ),
            );
          // Sales whose offline price/discount could not be authorised are held on
          // the server (quarantined) and must be approved by a manager. They stay in
          // the local queue so the cashier can see that they are unresolved.
          const quarantined = failed.filter((entry) => entry.quarantined);

          if (quarantined.length > 0) {
            toast.error(
              ar
                ? `${quarantined.length} عملية تحتاج موافقة المدير ولم تُرحّل.`
                : `${quarantined.length} sale(s) need manager approval and were not posted.`,
              { id: toastId, icon: '🔒', duration: 8000 },
            );
          } else if (failed.length > 0 && syncedIds.length > 0) {
            toast.error(
              ar
                ? `تم ترحيل ${syncedIds.length}؛ تحتاج ${failed.length} عملية للمراجعة.`
                : `${syncedIds.length} posted; ${failed.length} require review.`,
              {
                id: toastId,
                icon: '⚠️',
                duration: 6000,
              },
            );
          } else if (failed.length > 0) {
            toast.error(
              ar
                ? `${failed.length} عملية لم تُرحّل. راجع حالة التسوية.`
                : `${failed.length} sale(s) not posted. Check reconciliation status.`,
              {
                id: toastId,
                icon: '⚠️',
                duration: 5000,
              },
            );
          } else {
            toast.success(
              ar
                ? `تم ترحيل ${syncedIds.length} عملية وتسوية ${reconciledIds.length} عملية مرفوضة.`
                : `Posted ${syncedIds.length} sale(s); reconciled ${reconciledIds.length} rejected entry/entries.`,
              {
                id: toastId,
                icon: '✅',
                duration: 4000,
              },
            );
            flushedAnything = true;
          }
        } else {
          toast.error(ar ? 'تعذرت المزامنة.' : 'Offline synchronization failed.', {
            id: toastId,
            icon: '⚠️',
            duration: 5000,
          });
        }
      } catch (err: any) {
        console.error('[SyncService] Failed to flush offline sales:', err);
        toast.error(
          ar
            ? 'تعذرت المزامنة. أعد المحاولة عند استقرار الاتصال.'
            : 'Sync failed. Retry when the connection stabilizes.',
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
      const toastId = toast.loading(
        ar ? 'جارٍ مزامنة إغلاق الورديات…' : 'Synchronizing shift closures…',
        {
          position: 'top-right',
        },
      );

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
        toast.success(ar ? 'تمت مزامنة إغلاق الورديات.' : 'Shift closures synchronized.', {
          icon: '🔒',
          duration: 3000,
        });
        flushedAnything = true;
      }
    }

    return flushedAnything;
  } finally {
    isFlushInProgress = false;
    useLANStore.getState().setSyncing(false);
  }
}

/** Expose the public API of the service */
export const SyncService = {
  tryFlush,
  get isFlushing() {
    return isFlushInProgress;
  },
};
