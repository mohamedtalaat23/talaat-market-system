import React, { useMemo } from 'react';
import type { POSCartItem } from '../usePOSStore';
import { usePOSStore } from '../usePOSStore';
import { useModalStore } from '@/stores/modalStore';
import { bankersRound } from '@/utils/currency';
import { useTranslation } from '@/hooks/useTranslation';

interface POSSummaryProps {
  cart: POSCartItem[];
  paymentMethod: string;
  cashReceived: number;
}

export const POSSummary = React.memo(({ cart, paymentMethod, cashReceived }: POSSummaryProps) => {
  const { t } = useTranslation();
  const openModal = useModalStore((state) => state.openModal);
  const selectedCustomer = usePOSStore((state) => state.selectedCustomer);
  const selectCustomer = usePOSStore((state) => state.selectCustomer);
  const globalDiscount = usePOSStore((state) => state.globalDiscount);

  const { rawSubtotal, rawDiscount } = useMemo(
    () => ({
      rawSubtotal: cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      rawDiscount: cart.reduce((sum, item) => sum + item.discount, 0),
    }),
    [cart],
  );

  const subtotal = bankersRound(rawSubtotal);
  const discount = bankersRound(rawDiscount);
  const total = bankersRound(subtotal - discount - globalDiscount);

  return (
    <div className="flex flex-col h-full justify-between font-sans">
      <div className="space-y-4">
        {/* Customer Widget */}
        <div className="bg-card rounded p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
              {t('pos.cartCustomer')}
            </span>
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => selectCustomer(null)}
                className="text-[9px] font-bold text-danger hover:text-danger/80 focus:outline-none transition-colors"
                title={t('pos.disconnectCustomer')}
              >
                {t('pos.disconnectCustomer')}
              </button>
            )}
          </div>
          {selectedCustomer ? (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-sm">{selectedCustomer.name}</span>
              <div className="flex items-center justify-between text-xs mt-1.5 text-secondary font-mono">
                <span>{selectedCustomer.phone || t('customers.phone')}</span>
                <span
                  className={`font-semibold ${
                    selectedCustomer.balance < 0
                      ? 'text-danger'
                      : selectedCustomer.balance > 0
                        ? 'text-success'
                        : 'text-secondary'
                  }`}
                >
                  {Number(selectedCustomer.balance).toFixed(2)} EGP
                </span>
              </div>
              <button
                type="button"
                onClick={() => openModal('pos_customer_select')}
                className="w-full text-center mt-3 text-[10px] font-semibold text-secondary hover:text-foreground transition-colors py-1.5 border border-border hover:bg-card rounded"
              >
                {t('pos.changeCustomer')}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <span className="text-xs italic text-muted font-medium">{t('pos.walkIn')}</span>
              <button
                type="button"
                onClick={() => openModal('pos_customer_select')}
                className="text-xs font-bold text-success hover:text-success/80 focus:outline-none transition-colors border border-success/30 bg-success/10 px-3 py-1 rounded"
              >
                {t('pos.selectCustomer')}
              </button>
            </div>
          )}
        </div>

        <div className="bg-card rounded p-4 border border-border">
          <div className="flex justify-between text-secondary mb-2">
            <span>{t('pos.subtotal')}</span>
            <span>EGP {subtotal.toFixed(2)}</span>
          </div>
          {(discount > 0 || globalDiscount > 0) && (
            <div className="flex flex-col space-y-1 mb-2 text-sm text-success">
              {discount > 0 && (
                <div className="flex justify-between">
                  <span>{t('pos.itemDiscounts')}</span>
                  <span>- EGP {discount.toFixed(2)}</span>
                </div>
              )}
              {globalDiscount > 0 && (
                <div className="flex justify-between">
                  <span>{t('pos.globalDiscount')}</span>
                  <span>- EGP {globalDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          <div className="w-full h-px bg-border my-4"></div>
          <div className="flex justify-between text-foreground text-3xl font-bold tracking-tight">
            <span>{t('pos.total')}</span>
            <span>EGP {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openModal('pos_payment')}
            className="py-4 bg-success hover:bg-success/90 rounded font-bold text-white transition-colors text-lg shadow-lg shadow-success/10"
          >
            {t('pos.payAction')}
          </button>
          <button
            onClick={() => openModal('pos_manager_override', { action: 'void_transaction' })}
            className="py-4 bg-card hover:bg-card-hover rounded font-bold text-secondary hover:text-foreground transition-colors border border-border"
          >
            {t('pos.voidAction')}
          </button>
        </div>
      </div>
    </div>
  );
});

POSSummary.displayName = 'POSSummary';
