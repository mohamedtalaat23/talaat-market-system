/**
 * LANSyncManager — Reactive UI + Heartbeat Coordinator
 *
 * This component is now intentionally thin. Its only responsibilities are:
 *   1. Running the heartbeat polling loop (network concern, belongs here
 *      because it needs component lifecycle cleanup via useEffect return).
 *   2. Calling SyncService.tryFlush() when connectivity is restored.
 *   3. Rendering the floating status banner.
 *
 * All sync/flush business logic lives in SyncService.ts. This separation
 * eliminates the previous race condition where two separate useEffect hooks
 * each independently managed a `flushInProgressRef`, allowing concurrent
 * execution of the sales flush and the shift-closures flush.
 */

import { useEffect, useState, useRef } from 'react';
import { useLANStore } from '../stores/useLANStore';
import { apiClient } from '@/services/api-client';
import { SyncService } from '../services/SyncService';
import toast from 'react-hot-toast';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function LANSyncManager() {
  const { mode, status, hostAddress, offlineSales, setStatus } = useLANStore();
  // Local state mirrors the service singleton's flag for UI rendering only
  const [isFlushing, setIsFlushing] = useState(false);
  const flushingRef = useRef(false);

  // ── Heartbeat Poller ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'client') {
      // Standalone/Master nodes are always online with their own servers
      if (status !== 'online') setStatus('online');
      return;
    }

    const checkConnection = async () => {
      // Pause polling when the window is backgrounded
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await apiClient.get('/health', {
          signal: controller.signal,
          params: { _t: Date.now() },
        });

        clearTimeout(timeoutId);

        if (status !== 'online') {
          setStatus('online');
          toast.success('Connection to Host Master restored', {
            id: 'lan-status-toast',
            icon: '📶',
            duration: 3000,
          });
        }
      } catch {
        if (status !== 'offline') {
          setStatus('offline');
          toast.error('Host Master is unreachable. Operating offline.', {
            id: 'lan-status-toast',
            icon: '🔌',
            duration: 5000,
          });
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [mode, status, hostAddress, setStatus]);

  // ── Sync Trigger ────────────────────────────────────────────────────────────
  // Fires once when status transitions to 'online' or when the offline queue
  // gains new entries while already online. Delegates all work to SyncService,
  // which owns the single flush-in-progress lock.
  useEffect(() => {
    if (status !== 'online' || flushingRef.current) return;

    const { offlineSales, offlineShiftClosures } = useLANStore.getState();
    if (offlineSales.length === 0 && offlineShiftClosures.length === 0) return;

    flushingRef.current = true;
    setIsFlushing(true);

    SyncService.tryFlush().finally(() => {
      flushingRef.current = false;
      setIsFlushing(false);
    });
  }, [status, offlineSales]);

  // This component only renders in client mode
  if (mode !== 'client') return null;

  return (
    <div className="fixed bottom-4 end-4 z-[400] flex flex-col space-y-2">
      {status === 'offline' && (
        <div className="flex items-center space-x-2 bg-danger/90 border border-danger/60 text-white px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-sm animate-bounce">
          <WifiOff size={16} className="text-white/80 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">OFFLINE REGISTER</span>
        </div>
      )}
      {status === 'online' && isFlushing && (
        <div className="flex items-center space-x-2 bg-success/90 border border-success/60 text-white px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-sm">
          <RefreshCw size={16} className="text-white/80 animate-spin" />
          <span className="text-xs font-semibold tracking-wide">
            SYNCING WITH MASTER ({offlineSales.length})
          </span>
        </div>
      )}
      {status === 'online' && !isFlushing && offlineSales.length === 0 && (
        <div className="flex items-center space-x-2 bg-card/80 border border-border/80 text-secondary px-3 py-1.5 rounded-md shadow-md opacity-30 hover:opacity-100 transition-opacity">
          <Wifi size={14} className="text-success" />
          <span className="text-xs font-medium uppercase tracking-wider">Master Online</span>
        </div>
      )}
    </div>
  );
}
