import React, { useRef, useEffect, useState } from 'react';
import { usePOSStore } from '../usePOSStore';
import type { POSCartItem } from '../usePOSStore';
import { useTranslation } from '@/hooks/useTranslation';

export const POSCartList = React.memo(() => {
  const { t } = useTranslation();
  const cart = usePOSStore((state) => state.cart);
  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const setActiveItemIndex = usePOSStore((state) => state.setActiveItemIndex);
  const updateQuantity = usePOSStore((state) => state.updateQuantity);
  const removeItem = usePOSStore((state) => state.removeItem);


  const listRef = useRef<HTMLDivElement>(null);
  const [lastUpdatedCartId, setLastUpdatedCartId] = useState<string | null>(null);
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editQtyStr, setEditQtyStr] = useState('');
  const prevCartRef = useRef<POSCartItem[]>(cart);

  const handleQtySubmit = (cartId: string) => {
    const qty = parseInt(editQtyStr, 10);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(cartId, qty);
    } else if (qty === 0) {
      removeItem(cartId);
    }
    setEditingCartId(null);
  };

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
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none border border-border/60 bg-neutral-50/30 rounded">
      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-secondary bg-neutral-50/50 p-6 text-center select-none">
          <h3 className="text-sm font-bold text-neutral-400 mb-1">{t('pos.scanPrompt')}</h3>
          <p className="text-xs text-neutral-400/70 max-w-[220px]">
            {t('pos.searchPrompt')}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem_5.5rem] gap-2 px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-border/60 bg-neutral-100/50 shrink-0">
            <span className="pl-6">Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right pr-2">Total</span>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-border/40">
            {cart.map((item, index) => {
              const isActive = index === activeItemIndex;
              const isFlash = item.cart_id === lastUpdatedCartId;
              const itemTotal = item.quantity * item.unit_price - item.discount;

              let badgeClass = "text-foreground font-black";
              if (item.quantity >= 20) badgeClass = "bg-danger text-white px-1.5 py-0.5 rounded font-black text-[10px] shadow-sm";
              else if (item.quantity >= 10) badgeClass = "bg-orange-500 text-white px-1.5 py-0.5 rounded font-black text-[10px] shadow-sm";
              else if (item.quantity >= 5) badgeClass = "bg-yellow-500 text-white px-1.5 py-0.5 rounded font-bold text-[10px] shadow-sm";

              return (
                <div
                  key={item.cart_id}
                  onClick={() => {
                    setActiveItemIndex(index);
                    if (editingCartId && editingCartId !== item.cart_id) {
                      handleQtySubmit(editingCartId);
                    }
                  }}
                  onDoubleClick={() => {
                    setEditingCartId(item.cart_id);
                    setEditQtyStr(String(item.quantity));
                  }}
                  className={`cart-item-row px-3 h-12 flex items-center cursor-pointer transition-colors border-l-[4px] ${
                    isActive
                      ? 'bg-primary/5 border-l-primary shadow-inner'
                      : 'bg-white hover:bg-neutral-50 border-l-transparent'
                  } text-sm select-none relative ${
                    isFlash ? 'animate-focus-row' : ''
                  }`}
                >
                  <div className="grid grid-cols-[1fr_4.5rem_4.5rem_5.5rem] gap-2 items-center w-full min-w-0">
                    {/* Column 1: Item Name */}
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono text-[10px] font-bold text-neutral-400 shrink-0 select-none w-4 text-right">
                        {index + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className={`font-bold truncate leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {item.name}
                        </span>
                        {item.discount > 0 ? (
                          <span className="text-[10px] text-danger font-mono font-medium leading-none mt-0.5 truncate">
                            Disc: -{item.discount.toFixed(2)}
                          </span>
                        ) : item.barcode && isActive ? (
                          <span className="text-[9px] text-neutral-400 font-mono leading-none mt-0.5 truncate">
                            {item.barcode}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Column 2: Quantity */}
                    <div className="text-center shrink-0">
                      {editingCartId === item.cart_id ? (
                        <input
                          autoFocus
                          type="number"
                          className="w-12 h-7 text-center text-xs font-bold border border-primary rounded focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white shadow-inner"
                          value={editQtyStr}
                          onChange={(e) => setEditQtyStr(e.target.value)}
                          onBlur={() => handleQtySubmit(item.cart_id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQtySubmit(item.cart_id);
                            if (e.key === 'Escape') setEditingCartId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div 
                          className="flex justify-center items-center h-full w-full"
                          onClick={(e) => {
                            if (isActive) {
                              e.stopPropagation();
                              setEditingCartId(item.cart_id);
                              setEditQtyStr(String(item.quantity));
                            }
                          }}
                        >
                          <span className={`${badgeClass} transition-colors inline-block min-w-[1.5rem]`}>
                            {item.quantity}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Column 3: Price */}
                    <div className={`font-mono text-xs text-right shrink-0 ${isActive ? 'text-foreground font-semibold' : 'text-secondary'}`}>
                      {item.unit_price.toFixed(2)}
                    </div>

                    {/* Column 4: Total */}
                    <div className={`font-mono text-right pr-2 shrink-0 truncate ${isActive ? 'text-primary font-black text-[14px]' : 'text-foreground font-bold text-[13px]'}`}>
                      {itemTotal.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

POSCartList.displayName = 'POSCartList';
