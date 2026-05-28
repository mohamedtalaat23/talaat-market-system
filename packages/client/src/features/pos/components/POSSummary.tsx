import React from 'react';
import type { POSCartItem } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';

interface POSSummaryProps {
  cart: POSCartItem[];
  paymentMethod: string;
  cashReceived: number;
}

export const POSSummary = React.memo(({ cart, paymentMethod, cashReceived }: POSSummaryProps) => {
  const openModal = useModalStore((state) => state.openModal);
  
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - discount;

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="space-y-4">
        <div className="bg-slate-800 rounded p-4">
          <div className="flex justify-between text-slate-400 mb-2">
            <span>Subtotal</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-emerald-400 mb-2">
            <span>Discount</span>
            <span>- EGP {discount.toFixed(2)}</span>
          </div>
          <div className="w-full h-px bg-slate-700 my-4"></div>
          <div className="flex justify-between text-white text-3xl font-bold tracking-tight">
            <span>Total</span>
            <span>EGP {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => openModal('pos_payment')}
            className="py-4 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white transition-colors text-lg shadow-lg shadow-emerald-900/20"
          >
            Pay (Space)
          </button>
          <button 
            onClick={() => openModal('pos_manager_override', { action: 'void_transaction' })}
            className="py-4 bg-slate-800 hover:bg-slate-700 rounded font-bold text-slate-300 transition-colors border border-slate-700"
          >
            Void (F8)
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';
