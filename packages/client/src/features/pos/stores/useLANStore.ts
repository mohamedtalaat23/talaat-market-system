import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

export const useLANStore = create<LANState>()(
  persist(
    (set) => ({
      mode: 'standalone',
      hostAddress: 'http://localhost:3001',
      status: 'online',
      offlineSales: [],
      offlineShiftClosures: [],

      setMode: (mode) => set({ mode }),
      setHostAddress: (hostAddress) => set({ hostAddress }),
      setStatus: (status) => set({ status }),
      addOfflineSale: (sale) => set((state) => ({
        offlineSales: [...state.offlineSales, sale]
      })),
      removeOfflineSale: (id) => set((state) => ({
        offlineSales: state.offlineSales.filter((sale) => sale.id !== id)
      })),
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
      storage: createJSONStorage(() => localStorage),
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
