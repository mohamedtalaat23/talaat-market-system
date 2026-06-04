import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { POSCartList } from '../POSCartList';
import { usePOSStore } from '../../usePOSStore';

// Mock translation hook
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

describe('POSCartList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePOSStore.setState({
      cart: [],
      activeItemIndex: 0,
      globalDiscount: 0,
    });
  });

  it('should render the scan prompt when the cart is empty', () => {
    render(<POSCartList />);

    expect(screen.getByText('pos.scanPrompt')).toBeInTheDocument();
    expect(screen.getByText(/pos.searchPrompt/)).toBeInTheDocument();
  });

  it('should render items in the cart', () => {
    usePOSStore.setState({
      cart: [
        {
          cart_id: 'item-1',
          product_id: 101,
          barcode: '111111',
          name: 'Fresh Milk',
          name_ar: 'حليب طازج',
          unit_price: 25.5,
          quantity: 2,
          discount: 5.0,
          unit: 'pack',
          inventory_quantity: 10,
        },
      ],
      activeItemIndex: 0,
    });

    render(<POSCartList />);

    expect(screen.getByText('Fresh Milk')).toBeInTheDocument();
    expect(screen.getByText('111111')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Quantity
    expect(screen.getByText('pack x EGP 25.50')).toBeInTheDocument();
    // total = (25.5 * 2) - 5 = 46
    expect(screen.getByText('EGP 46.00')).toBeInTheDocument();
    expect(screen.getByText('pos.itemDiscount: -EGP 5.00')).toBeInTheDocument();
  });

  it('should change the active item when a row is clicked', () => {
    usePOSStore.setState({
      cart: [
        {
          cart_id: 'item-1',
          product_id: 101,
          barcode: '111111',
          name: 'Fresh Milk',
          name_ar: 'حليب طازج',
          unit_price: 25.5,
          quantity: 1,
          discount: 0,
          unit: 'pack',
          inventory_quantity: 10,
        },
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
      activeItemIndex: 0,
    });

    render(<POSCartList />);

    const appleRow = screen.getByText('Apple').closest('div');
    expect(appleRow).toBeDefined();

    // Click Second Item
    fireEvent.click(appleRow!);
    expect(usePOSStore.getState().activeItemIndex).toBe(1);
  });

  it('should call updateQuantity with currentQuantity + 1 when plus is clicked', () => {
    usePOSStore.setState({
      cart: [
        {
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
        },
      ],
    });

    render(<POSCartList />);

    const plusButton = screen.getAllByRole('button')[1]; // second button is plus (minus is first)
    fireEvent.click(plusButton);

    expect(usePOSStore.getState().cart[0].quantity).toBe(3);
  });

  it('should call updateQuantity with currentQuantity - 1 when minus is clicked and quantity > 1', () => {
    usePOSStore.setState({
      cart: [
        {
          cart_id: 'item-1',
          product_id: 101,
          barcode: '111111',
          name: 'Fresh Milk',
          name_ar: 'حليب طازج',
          unit_price: 25.5,
          quantity: 5,
          discount: 0,
          unit: 'pack',
          inventory_quantity: 10,
        },
      ],
    });

    render(<POSCartList />);

    const minusButton = screen.getAllByRole('button')[0]; // first button is minus
    fireEvent.click(minusButton);

    expect(usePOSStore.getState().cart[0].quantity).toBe(4);
  });

  it('should call removeItem when minus is clicked and quantity is 1', () => {
    usePOSStore.setState({
      cart: [
        {
          cart_id: 'item-1',
          product_id: 101,
          barcode: '111111',
          name: 'Fresh Milk',
          name_ar: 'حليب طازج',
          unit_price: 25.5,
          quantity: 1,
          discount: 0,
          unit: 'pack',
          inventory_quantity: 10,
        },
      ],
    });

    render(<POSCartList />);

    const minusButton = screen.getAllByRole('button')[0];
    fireEvent.click(minusButton);

    expect(usePOSStore.getState().cart.length).toBe(0);
  });
});
