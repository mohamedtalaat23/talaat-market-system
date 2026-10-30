import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuspendedCartsModal } from '../SuspendedCartsModal';
import { usePOSStore } from '../../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { useAuthStore } from '@/stores/authStore';

// Mock translation hook
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

describe('SuspendedCartsModal & Focus Trap Integration', () => {
  const sampleCartItem = {
    cart_id: 'item-1',
    product_id: 101,
    barcode: '111111',
    name: 'Fresh Milk',
    name_ar: 'حليب طازج',
    unit_price: 25.5,
    quantity: 2,
    discount: 0,
    unit: 'pack',
    inventory_quantity: 10,
  };

  const sampleHeldCart = {
    hold_id: 'cart-b',
    cashier_id: 1,
    timestamp: new Date().toISOString(),
    cart: [
      {
        cart_id: 'item-2',
        product_id: 102,
        barcode: '222222',
        name: 'Apple',
        name_ar: 'تفاح',
        unit_price: 15.0,
        quantity: 3,
        discount: 0,
        unit: 'kg',
        inventory_quantity: 50,
      },
    ],
    globalDiscount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup stores to fresh states
    usePOSStore.setState({
      cart: [],
      heldCarts: [],
      globalDiscount: 0,
      cashReceived: 0,
      paymentMethod: 'cash',
      selectedCustomer: null,
    });

    useModalStore.setState({
      activeModals: {
        pos_suspended_carts: true,
      } as any,
    });

    useAuthStore.setState({
      user: { id: 1, role: 'cashier', full_name: 'Test Cashier' },
    });

    // Clear document active element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it('TC1: Renders active cart warning and shows overwrite warning modal on resume attempt', () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);

    // Warning banner should be rendered
    expect(screen.getByText('pos.activeCartWarning')).toBeInTheDocument();
    expect(screen.getByText('pos.suspendActiveCart')).toBeInTheDocument();

    // Click Resume button
    const resumeBtn = screen.getByText('pos.resume');
    fireEvent.click(resumeBtn);

    // Overwrite modal view should mount
    expect(screen.getByText('pos.activeCartOverwrite')).toBeInTheDocument();
    expect(screen.getByText('pos.overwriteWarning')).toBeInTheDocument();
    expect(screen.getByText('pos.suspendCurrentCart')).toBeInTheDocument();
    expect(screen.getByText('pos.discardCurrentCart')).toBeInTheDocument();
  });

  it('TC2: Suspends the active cart and resumes target cart when clicking Suspend & Resume', () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);

    // Click Resume
    fireEvent.click(screen.getByText('pos.resume'));

    // Click Suspend & Resume
    fireEvent.click(screen.getByText('pos.suspendCurrentCart'));

    const state = usePOSStore.getState();

    // Active cart should be the target cart now
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].name).toBe('Apple');

    // Original cart should be moved to held carts queue
    expect(state.heldCarts.length).toBe(1);
    expect(state.heldCarts[0].cart[0].name).toBe('Fresh Milk');
  });

  it('TC3: Discards the active cart and resumes target cart when clicking Discard & Resume', () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);

    // Click Resume
    fireEvent.click(screen.getByText('pos.resume'));

    // Click Discard & Resume
    fireEvent.click(screen.getByText('pos.discardCurrentCart'));

    const state = usePOSStore.getState();

    // Target cart is resumed
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].name).toBe('Apple');

    // Held carts queue is empty (discarded)
    expect(state.heldCarts.length).toBe(0);
  });

  it("TC4-s: Keyboard Shortcut 's' suspends and resumes inside overwrite view", () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);
    fireEvent.click(screen.getByText('pos.resume'));
    fireEvent.keyDown(window, { key: 's' });

    const state = usePOSStore.getState();
    expect(state.cart[0].name).toBe('Apple');
    expect(state.heldCarts[0].cart[0].name).toBe('Fresh Milk');
  });

  it("TC4-d: Keyboard Shortcut 'd' discards and resumes inside overwrite view", () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);
    fireEvent.click(screen.getByText('pos.resume'));
    fireEvent.keyDown(window, { key: 'd' });

    const state = usePOSStore.getState();
    expect(state.cart[0].name).toBe('Apple');
    expect(state.heldCarts.length).toBe(0);
  });

  it('TC4-c-esc: Keyboard Shortcuts C and Escape back out of overwrite view', () => {
    usePOSStore.setState({
      cart: [sampleCartItem],
      heldCarts: [sampleHeldCart],
    });

    render(<SuspendedCartsModal />);
    fireEvent.click(screen.getByText('pos.resume'));

    // Overwrite modal view open
    expect(screen.getByText('pos.activeCartOverwrite')).toBeInTheDocument();

    // C. Press 'c' to cancel
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.queryByText('pos.activeCartOverwrite')).not.toBeInTheDocument();
    expect(screen.getByText('pos.suspended')).toBeInTheDocument();

    // D. Press 'Escape' key on queue screen closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useModalStore.getState().activeModals.pos_suspended_carts).toBe(false);
  });

  it('TC5: Focus Trap wraps focus inside the modal and restores focus on close', async () => {
    // Setup a dummy button that triggers the modal
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'trigger-button';
    triggerBtn.textContent = 'Trigger'; // Give name so screen.getByRole('button', { name: '' }) excludes it
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    usePOSStore.setState({
      cart: [],
      heldCarts: [sampleHeldCart],
    });

    const { unmount } = render(<SuspendedCartsModal />);

    // Modal opens. Focus should immediately move inside the modal to the first focusable element.
    // The modal has buttons: close button and resume/discard buttons.
    // Wait for animation frame of focus hook.
    await waitFor(() => {
      expect(document.activeElement).not.toBe(triggerBtn);
      expect(document.activeElement).not.toBeNull();
    });

    // Grab all focusable elements
    const closeBtn = screen.getByRole('button', { name: '' }); // Lucide X button has no name
    const _discardBtn = screen.getByText('pos.discard');
    const resumeBtn = screen.getByText('pos.resume');

    // Focus close button (first element)
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    // Simulate Shift+Tab on first element -> wraps to last element (resumeBtn)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(resumeBtn);

    // Focus resume button (last element)
    resumeBtn.focus();

    // Simulate Tab on last element -> wraps to first element (closeBtn)
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Unmount modal (simulating close)
    unmount();

    // Focus should be restored to triggerBtn
    expect(document.activeElement).toBe(triggerBtn);

    // Cleanup DOM
    document.body.removeChild(triggerBtn);
  });
});
