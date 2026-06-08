import React, { useRef, useEffect, useState } from 'react';
import { usePOSStore } from '../usePOSStore';
import type { POSCartItem } from '../usePOSStore';
import { useTranslation } from '@/hooks/useTranslation';

export const POSCartList = React.memo(() => {
  const { t } = useTranslation();
  const cart = usePOSStore((state) => state.cart);
  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const setActiveItemIndex = usePOSStore((state) => state.setActiveItemIndex);

  const listRef = useRef<HTMLTableSectionElement>(null);
  const [lastUpdatedCartId, setLastUpdatedCartId] = useState<string | null>(null);
  const prevCartRef = useRef<POSCartItem[]>(cart);

  // Auto-scroll to active item row
  useEffect(() => {
    if (listRef.current && cart.length > 0) {
      const activeElement = listRef.current.children[activeItemIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }, [activeItemIndex, cart.length]);

  // Handle flash highlight animation on item scan/quantity change
  useEffect(() => {
    const prev = prevCartRef.current;
    if (cart.length > 0) {
      let changedCartId: string | null = null;
      if (cart.length > prev.length) {
        changedCartId = cart[cart.length - 1]?.cart_id || null;
      } else {
        // Check if any quantity or discount changed
        for (const item of cart) {
          const prevItem = prev.find((p) => p.cart_id === item.cart_id);
          if (prevItem && (prevItem.quantity !== item.quantity || prevItem.discount !== item.discount)) {
            changedCartId = item.cart_id;
            break;
          }
        }
      }
      if (changedCartId) {
        setLastUpdatedCartId(changedCartId);
        const timer = setTimeout(() => setLastUpdatedCartId(null), 300);
        return () => clearTimeout(timer);
      }
    }
    prevCartRef.current = cart;
  }, [cart]);


  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-secondary p-8 bg-neutral-900">
          <p className="text-base font-semibold text-neutral-400">{t('pos.scanPrompt')}</p>
          <p className="text-xs text-neutral-500 mt-2 font-mono">
            {t('pos.searchPrompt')}{' '}
            <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300 border border-neutral-700">
              {t('pos.searchKey')}
            </kbd>{' '}
            {t('pos.searchPromptSuffix')}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left rtl:text-right border-collapse select-none">
            <thead className="sticky top-0 z-10 bg-neutral-950 border-b border-border">
              <tr className="h-10 text-[11px] font-bold uppercase tracking-wider text-secondary font-sans select-none">
                <th className="px-4 w-[5%]">#</th>
                <th className="px-4 w-[20%] font-mono">SKU</th>
                <th className="px-4 w-[45%]">Item Name</th>
                <th className="px-4 w-[10%] text-right">Qty</th>
                <th className="px-4 w-[10%] text-right">Price</th>
                <th className="px-4 w-[10%] text-right">Total</th>
              </tr>
            </thead>
            <tbody ref={listRef} className="divide-y divide-[#1F1F1F]">
              {cart.map((item, index) => {
                const isActive = index === activeItemIndex;
                const isFlash = item.cart_id === lastUpdatedCartId;
                const itemTotal = item.quantity * item.unit_price - item.discount;

                return (
                  <tr
                    key={item.cart_id}
                    onClick={() => setActiveItemIndex(index)}
                    className={`group h-12 cursor-pointer transition-all duration-fast select-none relative ${
                      isActive
                        ? 'bg-neutral-800 text-foreground border-l-2 border-primary pl-2'
                        : 'bg-transparent text-neutral-300 hover:bg-neutral-850'
                    } ${isFlash ? 'animate-focus-row' : ''}`}
                  >
                    <td className="px-4 font-mono text-xs text-secondary text-left select-none">
                      {index + 1}
                    </td>
                    <td className="px-4 font-mono text-xs text-secondary select-none">
                      {item.barcode || 'N/A'}
                    </td>
                    <td className="px-4 select-none">
                      <div className="flex flex-col">
                        <span className="font-sans font-medium text-sm text-foreground">
                          {item.name}
                        </span>
                        {item.name_ar && (
                          <span className="font-arabic text-xs text-secondary leading-tight mt-0.5">
                            {item.name_ar}
                          </span>
                        )}
                        {item.discount > 0 && (
                          <span className="text-[10px] text-danger font-mono font-medium mt-0.5">
                            -{item.discount.toFixed(2)} EGP ({t('pos.itemDiscount')})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 font-mono text-sm text-right text-foreground select-none">
                      <span className="font-bold">{item.quantity}</span>
                      <span className="text-[10px] text-secondary ml-1 select-none">{item.unit}</span>
                    </td>
                    <td className="px-4 font-mono text-sm text-right text-secondary select-none">
                      {item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 font-mono text-sm text-right font-bold text-foreground select-none">
                      {itemTotal.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

POSCartList.displayName = 'POSCartList';
