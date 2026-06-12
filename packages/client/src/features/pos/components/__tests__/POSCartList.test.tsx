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

  it('should render items in the cart table', () => {
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
    expect(screen.getByText('حليب طازج')).toBeInTheDocument();
    expect(screen.getByText('111111')).toBeInTheDocument();
    expect(screen.getAllByText('2')[0]).toBeInTheDocument(); // Quantity
    expect(screen.getByText('25.50')).toBeInTheDocument(); // Unit price column
    expect(screen.getByText('46.00')).toBeInTheDocument(); // Total column: (2 * 25.50) - 5.00
    expect(screen.getByText(/-5.00 EGP.*pos.itemDiscount/)).toBeInTheDocument();
  });

  it('should change the active item when a table row is clicked', () => {
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

    const appleRow = screen.getByText('Apple').closest('.cart-item-row');
    expect(appleRow).toBeDefined();

    // Click Second Item
    fireEvent.click(appleRow!);
    expect(usePOSStore.getState().activeItemIndex).toBe(1);
  });
});
