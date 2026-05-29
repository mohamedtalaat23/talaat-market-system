import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import toast from 'react-hot-toast';

export interface POSCartItem {
  cart_id: string; // unique ID for the cart row
  product_id: number;
  barcode: string | null;
  name: string;
  name_ar: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  unit: string;
  inventory_quantity: number;
}

export interface HeldCart {
  hold_id: string;
  cashier_id: number;
  timestamp: string;
  cart: POSCartItem[];
  globalDiscount: number;
}

export interface POSState {
  cart: POSCartItem[];
  paymentMethod: 'cash' | 'card' | 'split' | 'debt';
  cashReceived: number;
  activeItemIndex: number;
  globalDiscount: number;
  heldCarts: HeldCart[];
  activeShift: any | null; // Can type this properly later with a Shift interface
  registerId: number;
  autoPrintReceipts: boolean;
  lastSaleId: number | null;
  selectedCustomer: any | null;
  
  // Actions
  addItem: (item: Omit<POSCartItem, 'cart_id'>) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateItemDiscount: (cartId: string, discount: number) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
  setPaymentMethod: (method: 'cash' | 'card' | 'split' | 'debt') => void;
  setCashReceived: (amount: number) => void;
  setActiveItemIndex: (index: number) => void;
  setGlobalDiscount: (discount: number) => void;
  holdCurrentCart: (cashierId: number) => void;
  resumeCart: (holdId: string) => void;
  removeHeldCart: (holdId: string) => void;
  setActiveShift: (shift: any | null) => void;
  setRegisterId: (id: number) => void;
  setAutoPrintReceipts: (auto: boolean) => void;
  setLastSaleId: (id: number | null) => void;
  selectCustomer: (customer: any | null) => void;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set) => ({
      cart: [],
      paymentMethod: 'cash',
      cashReceived: 0,
      activeItemIndex: 0,
      globalDiscount: 0,
      heldCarts: [],
      activeShift: null,
      registerId: 1, // Default local register ID
      autoPrintReceipts: true,
      lastSaleId: null,
      selectedCustomer: null,
      
      addItem: (item) => set((state) => {
        const existingIndex = state.cart.findIndex(i => i.product_id === item.product_id && i.unit_price === item.unit_price && i.discount === 0);
        if (existingIndex >= 0 && item.discount === 0) {
          const existingItem = state.cart[existingIndex];
          if (!existingItem) return state;

          const nextQuantity = existingItem.quantity + item.quantity;

          // Non-blocking warning toast if the new total exceeds recorded stock boundaries
          if (nextQuantity > item.inventory_quantity) {
            toast.dismiss();
            toast.error(`Warning: Cart quantity (${nextQuantity}) exceeds recorded inventory (${item.inventory_quantity}) for "${item.name}".`, {
              icon: '⚠️',
              duration: 4000
            });
          }

          const newCart = [...state.cart];
          newCart[existingIndex] = {
            ...existingItem,
            quantity: nextQuantity
          };
          return { cart: newCart, activeItemIndex: existingIndex };
        }

        // Check stock boundaries for new item insertion
        if (item.quantity > item.inventory_quantity) {
          toast.dismiss();
          toast.error(`Warning: Cart quantity (${item.quantity}) exceeds recorded inventory (${item.inventory_quantity}) for "${item.name}".`, {
            icon: '⚠️',
            duration: 4000
          });
        }

        const newCart = [...state.cart, { ...item, cart_id: crypto.randomUUID() }];
        return { cart: newCart, activeItemIndex: newCart.length - 1 };
      }),
      
      updateQuantity: (cartId, quantity) => set((state) => {
        const newCart = state.cart.map(item => {
          if (item.cart_id === cartId) {
            // Trigger non-blocking warning toast on manually updated quantity overstock
            if (quantity > item.inventory_quantity) {
              toast.dismiss();
              toast.error(`Warning: Cart quantity (${quantity}) exceeds recorded inventory (${item.inventory_quantity}) for "${item.name}".`, {
                icon: '⚠️',
                duration: 4000
              });
            }
            return { ...item, quantity };
          }
          return item;
        });
        return { cart: newCart };
      }),

      updateItemDiscount: (cartId, discount) => set((state) => ({
        cart: state.cart.map(item => item.cart_id === cartId ? { ...item, discount } : item)
      })),
      
      removeItem: (cartId) => set((state) => {
        const newCart = state.cart.filter(item => item.cart_id !== cartId);
        return { 
          cart: newCart,
          activeItemIndex: Math.min(state.activeItemIndex, Math.max(0, newCart.length - 1))
        };
      }),
      
      clearCart: () => set({ cart: [], cashReceived: 0, paymentMethod: 'cash', activeItemIndex: 0, globalDiscount: 0, selectedCustomer: null }),
      
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      setCashReceived: (amount) => set({ cashReceived: amount }),
      setActiveItemIndex: (index) => set({ activeItemIndex: index }),
      setGlobalDiscount: (discount) => set({ globalDiscount: discount }),

      holdCurrentCart: (cashierId) => set((state) => {
        if (state.cart.length === 0) return state;
        const heldCart: HeldCart = {
          hold_id: crypto.randomUUID(),
          cashier_id: cashierId,
          timestamp: new Date().toISOString(),
          cart: [...state.cart],
          globalDiscount: state.globalDiscount,
        };
        return {
          heldCarts: [...state.heldCarts, heldCart],
          cart: [],
          cashReceived: 0,
          paymentMethod: 'cash',
          activeItemIndex: 0,
          globalDiscount: 0,
        };
      }),

      resumeCart: (holdId) => set((state) => {
        const heldCart = state.heldCarts.find(h => h.hold_id === holdId);
        if (!heldCart) return state;
        
        return {
          cart: heldCart.cart,
          globalDiscount: heldCart.globalDiscount,
          activeItemIndex: 0,
          cashReceived: 0,
          paymentMethod: 'cash',
          heldCarts: state.heldCarts.filter(h => h.hold_id !== holdId)
        };
      }),

      removeHeldCart: (holdId) => set((state) => ({
        heldCarts: state.heldCarts.filter(h => h.hold_id !== holdId)
      })),

      setActiveShift: (shift) => set({ activeShift: shift }),
      setRegisterId: (id) => set({ registerId: id }),
      setAutoPrintReceipts: (auto) => set({ autoPrintReceipts: auto }),
      setLastSaleId: (id) => set({ lastSaleId: id }),
      selectCustomer: (customer) => set({ selectedCustomer: customer }),
    }),
    {
      name: 'talaat-pos-cart-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
