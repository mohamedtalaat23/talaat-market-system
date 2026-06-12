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
        <div className="flex-1 flex flex-col items-center justify-center text-secondary bg-neutral-50 gap-4 py-16 px-8">
          {/* Icon anchor */}
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white border border-border">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-500"
              aria-hidden="true"
            >
              {/* Barcode icon lines */}
              <path d="M3 5v14M7 5v14M11 5v14M15 5v6M15 14v5M19 5v14" />
            </svg>
          </div>
          {/* Primary instruction */}
          <div className="text-center">
            <p className="text-base font-bold text-foreground">
              {t('pos.scanPrompt')}
            </p>
            {/* Secondary hint */}
            <p className="text-xs text-neutral-500 mt-2">
              {t('pos.searchPrompt')}{' '}
              <kbd className="inline-flex items-center px-1.5 py-0.5 bg-white rounded text-secondary border border-border font-mono text-xs font-semibold">
                {t('pos.searchKey')}
              </kbd>{' '}
              {t('pos.searchPromptSuffix')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left rtl:text-right border-collapse select-none">
            <thead className="sticky top-0 z-10 bg-neutral-100 border-b border-border">
              <tr className="h-10 text-xs font-bold uppercase tracking-wider text-secondary font-sans select-none">
                <th className="px-3 w-[4%]">#</th>
                <th className="px-3 w-[55%]">Item</th>
                <th className="px-3 w-[11%] text-right">Qty</th>
                <th className="px-3 w-[12%] text-right">Price</th>
                <th className="px-3 w-[18%] text-right">Total</th>
              </tr>
            </thead>
            <tbody ref={listRef} className="divide-y divide-border">
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
                        ? 'bg-primary-50 text-foreground border-l-2 border-primary pl-2'
                        : 'bg-white text-secondary hover:bg-neutral-50'
                    } ${isFlash ? 'animate-focus-row' : ''}`}
                  >
                    <td className="px-3 font-mono text-xs text-secondary text-left select-none">
                      {index + 1}
                    </td>
                    <td className="px-3 select-none">
                      <div className="flex flex-col">
                        <span className="font-sans font-semibold text-sm text-foreground">
                          {item.name}
                        </span>
                        {/* Barcode as subtext — replaces standalone SKU column */}
                        <span className="font-mono text-xs text-neutral-500 leading-tight">
                          {item.barcode || '—'}
                        </span>
                        {item.name_ar && (
                          <span className="font-arabic text-xs text-secondary leading-tight">
                            {item.name_ar}
                          </span>
                        )}
                        {item.discount > 0 && (
                          <span className="text-xs text-danger font-mono font-medium">
                            -{item.discount.toFixed(2)} EGP ({t('pos.itemDiscount')})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 font-mono text-sm text-right text-foreground select-none">
                      <span className="font-bold">{item.quantity}</span>
                      <span className="text-xs text-secondary ml-1 select-none">{item.unit}</span>
                    </td>
                    <td className="px-3 font-mono text-sm text-right text-secondary select-none">
                      {item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-3 font-mono text-sm text-right font-bold text-foreground select-none">
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
