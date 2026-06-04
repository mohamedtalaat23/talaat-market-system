import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePOSStore, type POSCartItem } from '../usePOSStore';
import toast from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('usePOSStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePOSStore.setState({
      cart: [],
      heldCarts: [],
      globalDiscount: 0,
      cashReceived: 0,
      paymentMethod: 'cash',
      selectedCustomer: null,
    });
    localStorage.clear();
  });

  const sampleItem: Omit<POSCartItem, 'cart_id'> = {
    product_id: 10,
    barcode: '123456789',
    name: 'Mineral Water',
    name_ar: 'مياه معدنية',
    unit_price: 1.5,
    quantity: 2,
    discount: 0,
    unit: 'bottle',
    inventory_quantity: 10,
  };

  it('should initially have an empty cart and cashReceived as 0', () => {
    const state = usePOSStore.getState();
    expect(state.cart).toEqual([]);
    expect(state.cashReceived).toBe(0);
    expect(state.paymentMethod).toBe('cash');
  });

  it('should add a new item to the cart and generate a cart_id', () => {
    usePOSStore.getState().addItem(sampleItem);

    const state = usePOSStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].name).toBe('Mineral Water');
    expect(state.cart[0].cart_id).toBeDefined();
    expect(state.cart[0].quantity).toBe(2);
  });

  it('should merge quantities if the same item with same price and no discount is added again', () => {
    usePOSStore.getState().addItem(sampleItem);
    usePOSStore.getState().addItem(sampleItem);

    const state = usePOSStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].quantity).toBe(4);
  });

  it('should trigger toast warning if added quantity exceeds inventory level', () => {
    const overstockItem = { ...sampleItem, quantity: 15 }; // inventory is 10

    usePOSStore.getState().addItem(overstockItem);

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('exceeds recorded inventory'),
      expect.any(Object)
    );
  });

  it('should update item quantity and trigger overstock warning if applicable', () => {
    usePOSStore.getState().addItem(sampleItem);
    const cartId = usePOSStore.getState().cart[0].cart_id;

    usePOSStore.getState().updateQuantity(cartId, 12); // inventory is 10

    const state = usePOSStore.getState();
    expect(state.cart[0].quantity).toBe(12);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('exceeds recorded inventory'),
      expect.any(Object)
    );
  });

  it('should update item discount', () => {
    usePOSStore.getState().addItem(sampleItem);
    const cartId = usePOSStore.getState().cart[0].cart_id;

    usePOSStore.getState().updateItemDiscount(cartId, 0.5);

    const state = usePOSStore.getState();
    expect(state.cart[0].discount).toBe(0.5);
  });

  it('should remove item from the cart', () => {
    usePOSStore.getState().addItem(sampleItem);
    const cartId = usePOSStore.getState().cart[0].cart_id;

    usePOSStore.getState().removeItem(cartId);

    const state = usePOSStore.getState();
    expect(state.cart.length).toBe(0);
  });

  it('should hold current cart and clear active cart state', () => {
    usePOSStore.getState().addItem(sampleItem);
    usePOSStore.getState().setGlobalDiscount(1.0);

    usePOSStore.getState().holdCurrentCart(1); // Cashier ID 1

    const state = usePOSStore.getState();
    expect(state.cart.length).toBe(0);
    expect(state.globalDiscount).toBe(0);
    expect(state.heldCarts.length).toBe(1);
    expect(state.heldCarts[0].cart[0].name).toBe('Mineral Water');
  });

  it('should resume a held cart', () => {
    usePOSStore.getState().addItem(sampleItem);
    usePOSStore.getState().holdCurrentCart(1);
    const holdId = usePOSStore.getState().heldCarts[0].hold_id;

    usePOSStore.getState().resumeCart(holdId);

    const state = usePOSStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].name).toBe('Mineral Water');
    expect(state.heldCarts.length).toBe(0);
  });
});
