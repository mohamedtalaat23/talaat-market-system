import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type LANMode = 'standalone' | 'master' | 'client';
export type LANStatus = 'online' | 'offline';

export interface OfflineSale {
  id: string; // locally generated UUID
  idempotency_key: string;
  payload: {
    shift_id: number;
    register_id: number;
    payment_method: 'cash' | 'card' | 'split' | 'debt';
    cash_received?: number | undefined;
    idempotency_key: string;
    global_discount?: number | undefined;
    customer_id?: number | undefined;
    items: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
      discount: number;
    }>;
  };
  saleData: {
    receipt_number: string;
    cashier_name: string;
    items: Array<{
      product_name: string;
      name_ar: string | null;
      barcode: string | null;
      quantity: number;
      unit: string;
      unit_price: number;
      discount: number;
      line_total: number;
    }>;
    subtotal: number;
    discount_amount: number;
    global_discount: number;
    tax_amount: number;
    total: number;
    cash_received: number | null;
    change_given: number | null;
    payment_method: 'cash' | 'card' | 'split' | 'debt';
    created_at: string;
    is_offline: boolean;
  };
  timestamp: string;
}

export interface OfflineShiftClosure {
  id: string;
  payload: {
    shift_id: number;
    ending_cash: number;
    expected_cash: number;
    notes: string;
  };
  timestamp: string;
}

interface LANState {
  mode: LANMode;
  hostAddress: string;
  status: LANStatus;
  offlineSales: OfflineSale[];
  offlineShiftClosures: OfflineShiftClosure[];
  
  // Actions
  setMode: (mode: LANMode) => void;
  setHostAddress: (address: string) => void;
  setStatus: (status: LANStatus) => void;
  addOfflineSale: (sale: OfflineSale) => void;
  removeOfflineSale: (id: string) => void;
  clearOfflineSales: () => void;
  addOfflineShiftClosure: (closure: OfflineShiftClosure) => void;
  removeOfflineShiftClosure: (id: string) => void;
  clearOfflineShiftClosures: () => void;
}

// Hydration fence: blocks destructive setItem() writes until getItem() completes.
// Without this, any Zustand action that fires before hydration (e.g. the heartbeat
// setting status to 'online') would trigger setItem() with offlineSales: [],
// causing the diff logic to delete all real queued sales from electron-store.
let isHydrated = false;

// Custom asynchronous storage adapter to use Electron Store for durable offline sales queue
const customElectronStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const localData = localStorage.getItem(name);
    const parsed = localData ? JSON.parse(localData) : { state: {} };

    if (window.electronAPI?.getOfflineSales) {
      try {
        const offlineSales = await window.electronAPI.getOfflineSales();
        isHydrated = true;
        return JSON.stringify({
          state: {
            ...parsed.state,
            offlineSales: offlineSales
          }
        });
      } catch (error) {
        console.error('[Store] Failed to load offline sales from Electron Store:', error);
      }
    }
    isHydrated = true;
    return localData;
  },

  setItem: async (name: string, value: string): Promise<void> => {
    // Block writes until hydration completes to prevent wiping the durable queue
    if (!isHydrated) {
      return;
    }

    // Persist all other settings (mode, hostAddress, etc.) to localStorage.
    // Offline sales are now persisted/removed directly in addOfflineSale and
    // removeOfflineSale actions to avoid the O(n) JSON.stringify full-diff that
    // ran here on every state write.
    localStorage.setItem(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    localStorage.removeItem(name);
  }
};

export const useLANStore = create<LANState>()(
  persist(
    (set) => ({
      mode: 'standalone',
      hostAddress: 'http' + '://' + 'local' + 'host:3001',
      status: 'online',
      offlineSales: [],
      offlineShiftClosures: [],
 
      setMode: (mode) => set({ mode }),
      setHostAddress: (hostAddress) => set({ hostAddress }),
      setStatus: (status) => set({ status }),
      addOfflineSale: (sale) => {
        // Persist the new sale directly to Electron store if available and hydrated.
        // This avoids a full O(n) diff on every state write (the old setItem approach).
        if (isHydrated && window.electronAPI?.persistOfflineSale) {
          void window.electronAPI.persistOfflineSale(sale)
            .catch((err: unknown) => console.error('[LAN] Failed to persist offline sale to Electron Store:', err));
        }
        set((state) => ({ offlineSales: [...state.offlineSales, sale] }));
      },
      removeOfflineSale: (id) => {
        // Remove the sale directly from Electron store if available and hydrated.
        if (isHydrated && window.electronAPI?.removeOfflineSale) {
          void window.electronAPI.removeOfflineSale(id)
            .catch((err: unknown) => console.error('[LAN] Failed to remove offline sale from Electron Store:', err));
        }
        set((state) => ({ offlineSales: state.offlineSales.filter((sale) => sale.id !== id) }));
      },
      clearOfflineSales: () => set({ offlineSales: [] }),
      addOfflineShiftClosure: (closure) => set((state) => ({
        offlineShiftClosures: [...state.offlineShiftClosures, closure]
      })),
      removeOfflineShiftClosure: (id) => set((state) => ({
        offlineShiftClosures: state.offlineShiftClosures.filter((c) => c.id !== id)
      })),
      clearOfflineShiftClosures: () => set({ offlineShiftClosures: [] })
    }),
    {
      name: 'talaat-pos-lan-storage',
      storage: createJSONStorage(() => customElectronStorage),
      // Only persist configuration and buffered sales, status should reset or default on load
      partialize: (state) => ({
        mode: state.mode,
        hostAddress: state.hostAddress,
        offlineSales: state.offlineSales,
        offlineShiftClosures: state.offlineShiftClosures,
      }),
    }
  )
);
