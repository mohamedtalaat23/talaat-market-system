import React, { useRef, useEffect } from 'react';
import { usePOSStore } from '../usePOSStore';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export const POSCartList = React.memo(() => {
  const { t } = useTranslation();
  const cart = usePOSStore((state) => state.cart);
  const activeItemIndex = usePOSStore((state) => state.activeItemIndex);
  const setActiveItemIndex = usePOSStore((state) => state.setActiveItemIndex);
  const updateQuantity = usePOSStore((state) => state.updateQuantity);
  const removeItem = usePOSStore((state) => state.removeItem);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active item
  useEffect(() => {
    if (listRef.current && cart.length > 0) {
      const activeElement = listRef.current.children[activeItemIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }, [activeItemIndex, cart.length]);

  const handleDecrease = (cartId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      removeItem(cartId);
    } else {
      updateQuantity(cartId, currentQuantity - 1);
    }
  };

  const handleIncrease = (cartId: string, currentQuantity: number) => {
    updateQuantity(cartId, currentQuantity + 1);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4" ref={listRef}>
      {cart.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-secondary">
          <p className="text-lg">{t('pos.scanPrompt')}</p>
          <p className="text-sm mt-2">
            {t('pos.searchPrompt')}{' '}
            <kbd className="px-2 py-1 bg-card-hover rounded text-foreground border border-border">
              {t('pos.searchKey')}
            </kbd>{' '}
            {t('pos.searchPromptSuffix')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cart.map((item, index) => {
            const isActive = index === activeItemIndex;
            return (
              <div
                key={item.cart_id}
                onClick={() => setActiveItemIndex(index)}
                className={`flex justify-between items-center p-3 rounded border cursor-pointer transition-colors ${isActive ? 'bg-success/15 border-success/50' : 'bg-card border-border hover:bg-card-hover'}`}
              >
                <div className="flex-1">
                  <div className={`font-semibold ${isActive ? 'text-success' : 'text-foreground'}`}>
                    {item.name}
                  </div>
                  <div className="text-sm text-secondary">{item.barcode}</div>
                  {item.discount > 0 && (
                    <div className="text-xs text-danger mt-1">
                      {t('pos.itemDiscount')}: -EGP {item.discount.toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-6">
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-3 bg-input rounded-lg p-1 border border-border">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecrease(item.cart_id, item.quantity);
                      }}
                      className="p-1 rounded text-secondary hover:text-foreground hover:bg-card-hover active:bg-border transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-mono font-bold text-lg min-w-[2ch] text-center text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIncrease(item.cart_id, item.quantity);
                      }}
                      className="p-1 rounded text-secondary hover:text-foreground hover:bg-card-hover active:bg-border transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Price Info */}
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm text-secondary">
                      {item.unit} x EGP {item.unit_price.toFixed(2)}
                    </div>
                    <div
                      className={`font-bold text-lg ${isActive ? 'text-success' : 'text-foreground'}`}
                    >
                      EGP {(item.quantity * item.unit_price - item.discount).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

POSCartList.displayName = 'POSCartList';
