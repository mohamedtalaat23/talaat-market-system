import { useEffect } from 'react';
import { usePOSStore } from '../usePOSStore';
import { useLANStore } from '../stores/useLANStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export function useShiftHeartbeat() {
  const activeShift = usePOSStore((state) => state.activeShift);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const status = useLANStore((state) => state.status);

  useEffect(() => {
    // Only check shift status if the register is online and has an active local shift
    if (status !== 'online' || !activeShift) return;

    const checkShiftStatus = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: any }>('/pos/shifts/current');
        
        if (response.data?.success) {
          const serverShift = response.data.data;
          
          // If the server says there is no current open shift for this cashier, or it has been closed
          if (!serverShift || serverShift.status === 'closed' || serverShift.id !== activeShift.id) {
            setActiveShift(null);
            toast.error('Active shift has been closed or terminated remotely. Cash-in required.', {
              id: 'shift-heartbeat-terminated',
              icon: '🔒',
              duration: 6000
            });
          }
        }
      } catch (error) {
        console.error('[Heartbeat] Failed to validate active shift status:', error);
      }
    };

    // Initial validation check
    checkShiftStatus();

    // Re-check every 3 minutes (180000ms)
    const interval = setInterval(checkShiftStatus, 180000);
    return () => clearInterval(interval);
  }, [activeShift, setActiveShift, status]);
}
