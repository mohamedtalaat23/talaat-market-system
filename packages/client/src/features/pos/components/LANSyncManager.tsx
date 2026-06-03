import { useEffect, useState, useRef } from 'react';
import { useLANStore } from '../stores/useLANStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function LANSyncManager() {
  const { 
    mode, 
    status, 
    hostAddress, 
    offlineSales, 
    offlineShiftClosures, 
    setStatus, 
    removeOfflineSale, 
    removeOfflineShiftClosure 
  } = useLANStore();
  const [isFlushing, setIsFlushing] = useState(false);
  const flushInProgressRef = useRef(false);

  // Heartbeat Poller
  useEffect(() => {
    if (mode !== 'client') {
      // Standalone/Master mode are always 'online' with their own servers
      if (status !== 'online') {
        setStatus('online');
      }
      return;
    }

    const checkConnection = async () => {
      // Pause polling if the document is not visible
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      try {
        // Query the `/health` endpoint of the master host
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout for heartbeat

        await apiClient.get('/health', {
          signal: controller.signal,
          // Add cache-busting query parameter
          params: { _t: Date.now() }
        });

        clearTimeout(timeoutId);

        if (status !== 'online') {
          setStatus('online');
          toast.success('Connection to Host Master restored', {
            id: 'lan-status-toast',
            icon: '📶',
            duration: 3000
          });
        }
      } catch (error) {
        if (status !== 'offline') {
          setStatus('offline');
          toast.error('Host Master is unreachable. Operating offline.', {
            id: 'lan-status-toast',
            icon: '🔌',
            duration: 5000
          });
        }
      }
    };

    // Initial check
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [mode, status, hostAddress, setStatus]);

  // Sync / Flush Task (Checkouts)
  useEffect(() => {
    // If online, have offline sales, and not currently flushing, run flush
    if (status === 'online' && offlineSales.length > 0 && !isFlushing && !flushInProgressRef.current) {
      const flushSales = async () => {
        setIsFlushing(true);
        flushInProgressRef.current = true;
        
        const toastId = toast.loading(`Synchronizing ${offlineSales.length} offline checkout(s) to Master...`, {
          position: 'top-right'
        });

        const salesToFlush = [...offlineSales];
        const payloads = salesToFlush.map(sale => sale.payload);

        try {
          const response = await apiClient.post('/pos/sync', { transactions: payloads });
          
          if (response.data?.success) {
            const syncedIdsFromServer: string[] = response.data.syncedIds || [];
            const failedFromServer: { id: string; error: string }[] = response.data.failed || [];
            const syncedSet = new Set(syncedIdsFromServer);

            // Remove ONLY successfully synced sales from the offline store buffer
            for (const sale of salesToFlush) {
              if (syncedSet.has(sale.id) || syncedSet.has(sale.payload.idempotency_key)) {
                removeOfflineSale(sale.id);
              }
            }

            if (failedFromServer.length > 0 && syncedIdsFromServer.length > 0) {
              toast.error(`${syncedIdsFromServer.length} synced, ${failedFromServer.length} failed. Check server logs.`, {
                id: toastId,
                icon: '⚠️',
                duration: 6000
              });
            } else if (failedFromServer.length > 0) {
              toast.error(`${failedFromServer.length} transaction(s) failed to sync. Will retry.`, {
                id: toastId,
                icon: '⚠️',
                duration: 5000
              });
            } else {
              toast.success(`Successfully synchronized ${syncedIdsFromServer.length} transaction(s) to Master.`, {
                id: toastId,
                icon: '✅',
                duration: 4000
              });
            }
          } else {
            toast.error('Offline synchronization failed.', {
              id: toastId,
              icon: '⚠️',
              duration: 5000
            });
          }
        } catch (error: any) {
          console.error('Failed to synchronize offline sales:', error);
          toast.error(error.response?.data?.message || 'Sync failed. Will retry when connection stabilizes.', {
            id: toastId,
            icon: '⚠️',
            duration: 5000
          });
        } finally {
          setIsFlushing(false);
          flushInProgressRef.current = false;
        }
      };

      flushSales();
    }
  }, [status, offlineSales, isFlushing, removeOfflineSale]);

  // Sync / Flush Task (Shift Closures)
  useEffect(() => {
    // If online, have offline shift closures, and not currently flushing, run flush
    if (status === 'online' && offlineShiftClosures.length > 0 && !isFlushing && !flushInProgressRef.current) {
      const flushClosures = async () => {
        setIsFlushing(true);
        flushInProgressRef.current = true;
        
        const toastId = toast.loading(`Synchronizing shift closure(s) to Master...`, {
          position: 'top-right'
        });

        const closuresToFlush = [...offlineShiftClosures];
        let successfulSyncs = 0;

        for (const closure of closuresToFlush) {
          try {
            // Throttled delay of 500ms to pace network requests
            await new Promise((resolve) => setTimeout(resolve, 500));
            
            await apiClient.post('/pos/shifts/close', closure.payload);
            removeOfflineShiftClosure(closure.id);
            successfulSyncs++;
          } catch (error: any) {
            console.error(`Failed to synchronize offline shift closure ${closure.id}:`, error);
            if (error.message?.includes('Network Error') || error.status === undefined) {
              break;
            }
          }
        }

        setIsFlushing(false);
        flushInProgressRef.current = false;
        toast.dismiss(toastId);

        if (successfulSyncs > 0) {
          toast.success(`Successfully synchronized shift closures to Master.`, {
            icon: '🔒',
            duration: 3000
          });
        }
      };

      flushClosures();
    }
  }, [status, offlineShiftClosures, isFlushing, removeOfflineShiftClosure]);

  // Render a subtle premium warning banner if in client mode and offline/flushing
  if (mode !== 'client') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col space-y-2">
      {status === 'offline' && (
        <div className="flex items-center space-x-2 bg-red-950/90 border border-red-800 text-red-200 px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-sm animate-bounce">
          <WifiOff size={16} className="text-red-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-wide">OFFLINE REGISTER</span>
        </div>
      )}
      {status === 'online' && isFlushing && (
        <div className="flex items-center space-x-2 bg-emerald-950/90 border border-emerald-800 text-emerald-200 px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-sm">
          <RefreshCw size={16} className="text-emerald-400 animate-spin" />
          <span className="text-xs font-semibold tracking-wide">SYNCING WITH MASTER ({offlineSales.length})</span>
        </div>
      )}
      {status === 'online' && !isFlushing && offlineSales.length === 0 && (
        <div className="flex items-center space-x-2 bg-card/80 border border-border/80 text-secondary px-3 py-1.5 rounded-md shadow-md opacity-30 hover:opacity-100 transition-opacity">
          <Wifi size={14} className="text-emerald-500" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Master Online</span>
        </div>
      )}
    </div>
  );
}
