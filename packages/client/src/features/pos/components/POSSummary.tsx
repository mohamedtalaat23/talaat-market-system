import React from 'react';
import type { POSCartItem } from '../usePOSStore';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';

interface POSSummaryProps {
  cart: POSCartItem[];
  paymentMethod: string;
  cashReceived: number;
}

export const POSSummary = React.memo(({ cart, paymentMethod, cashReceived }: POSSummaryProps) => {
  const openModal = useModalStore((state) => state.openModal);
  const selectedCustomer = usePOSStore((state) => state.selectedCustomer);
  const selectCustomer = usePOSStore((state) => state.selectCustomer);
  
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const discount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - discount;

  return (
    <div className="flex flex-col h-full justify-between font-sans">
      <div className="space-y-4">
        {/* Customer Widget */}
        <div className="bg-slate-800 rounded p-4 border border-slate-750">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cart Customer</span>
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => selectCustomer(null)}
                className="text-[9px] font-bold text-rose-400 hover:text-rose-300 focus:outline-none transition-colors"
                title="Remove customer from cart"
              >
                DISCONNECT
              </button>
            )}
          </div>
          {selectedCustomer ? (
            <div className="flex flex-col">
              <span className="font-semibold text-white text-sm">{selectedCustomer.name}</span>
              <div className="flex items-center justify-between text-xs mt-1.5 text-slate-400 font-mono">
                <span>{selectedCustomer.phone || 'No phone'}</span>
                <span
                  className={`font-semibold ${
                    selectedCustomer.balance < 0
                      ? 'text-rose-400'
                      : selectedCustomer.balance > 0
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {Number(selectedCustomer.balance).toFixed(2)} EGP
                </span>
              </div>
              <button
                type="button"
                onClick={() => openModal('pos_customer_select')}
                className="w-full text-center mt-3 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors py-1.5 border border-slate-700 hover:bg-slate-700/30 rounded"
              >
                Change Customer (F7)
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs italic text-slate-500 font-medium">Walk-in Customer</span>
              <button
                type="button"
                onClick={() => openModal('pos_customer_select')}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 focus:outline-none transition-colors border border-emerald-900/40 bg-emerald-950/20 px-3 py-1 rounded"
              >
                SELECT (F7)
              </button>
            </div>
          )}
        </div>

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
