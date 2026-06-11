import { describe, it, expect, beforeEach } from 'vitest';
import { usePOSStore } from '../usePOSStore';

describe('Cart Overwrite Protection Flow', () => {
  beforeEach(() => {
    usePOSStore.getState().clearCart();
    usePOSStore.setState({ heldCarts: [] });
  });

  it('preserves the active cart by suspending it before resuming another cart', () => {
    const store = usePOSStore.getState();
    
    // 1. Add items to active cart (Cart A)
    store.addItem({ product_id: 1, name: 'Item A', unit_price: 10, quantity: 1, discount: 0, unit: 'pcs', inventory_quantity: 10, barcode: '123' });
    store.addItem({ product_id: 2, name: 'Item B', unit_price: 20, quantity: 2, discount: 0, unit: 'pcs', inventory_quantity: 10, barcode: '456' });
    
    expect(usePOSStore.getState().cart.length).toBe(2);

    // 2. Mock a pre-existing suspended cart (Cart B)
    usePOSStore.setState({
      heldCarts: [{
        hold_id: 'cart-b',
        cashier_id: 1,
        cart: [{ cart_id: '1', product_id: 3, name: 'Item C', unit_price: 5, quantity: 1, discount: 0, unit: 'pcs', inventory_quantity: 10, barcode: '789' }],
        timestamp: new Date().toISOString(),
        cashReceived: 0,
        paymentMethod: 'cash',
        globalDiscount: 0
      }]
    });

    // 3. User clicks "Suspend Current Cart" on the overwrite modal
    usePOSStore.getState().holdCurrentCart(1);
    
    // Active cart should be cleared
    expect(usePOSStore.getState().cart.length).toBe(0);
    // Held carts should now be 2
    expect(usePOSStore.getState().heldCarts.length).toBe(2);

    // 4. User immediately resumes Cart B
    usePOSStore.getState().resumeCart('cart-b');

    // Active cart is now Cart B (length 1)
    expect(usePOSStore.getState().cart.length).toBe(1);
    expect(usePOSStore.getState().cart[0].name).toBe('Item C');

    // Held carts should be 1 (the original Cart A)
    expect(usePOSStore.getState().heldCarts.length).toBe(1);
    expect(usePOSStore.getState().heldCarts[0].cart.length).toBe(2);
    expect(usePOSStore.getState().heldCarts[0].cart[0].name).toBe('Item A');
  });

  it('discards the active cart before resuming another cart', () => {
    const store = usePOSStore.getState();
    
    // 1. Add items to active cart (Cart A)
    store.addItem({ product_id: 1, name: 'Item A', unit_price: 10, quantity: 1, discount: 0, unit: 'pcs', inventory_quantity: 10, barcode: '123' });
    
    // 2. Mock a pre-existing suspended cart (Cart B)
    usePOSStore.setState({
      heldCarts: [{
        hold_id: 'cart-b',
        cashier_id: 1,
        cart: [{ cart_id: '1', product_id: 3, name: 'Item C', unit_price: 5, quantity: 1, discount: 0, unit: 'pcs', inventory_quantity: 10, barcode: '789' }],
        timestamp: new Date().toISOString(),
        cashReceived: 0,
        paymentMethod: 'cash',
        globalDiscount: 0
      }]
    });

    // 3. User clicks "Discard Current Cart" on the overwrite modal
    usePOSStore.getState().clearCart();
    usePOSStore.getState().resumeCart('cart-b');

    // Active cart is Cart B
    expect(usePOSStore.getState().cart.length).toBe(1);
    expect(usePOSStore.getState().cart[0].name).toBe('Item C');

    // Held carts should be empty
    expect(usePOSStore.getState().heldCarts.length).toBe(0);
  });
});
