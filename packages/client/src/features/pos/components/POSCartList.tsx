import React, { useRef, useEffect } from 'react';
import { usePOSStore } from '../usePOSStore';
import { Plus, Minus } from 'lucide-react';

export const POSCartList = React.memo(() => {
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
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        <div className="h-full flex flex-col items-center justify-center text-slate-500">
          <p className="text-lg">Scan barcode to add items</p>
          <p className="text-sm mt-2">or press <kbd className="px-2 py-1 bg-slate-800 rounded text-slate-300">F5</kbd> to search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cart.map((item, index) => {
            const isActive = index === activeItemIndex;
            return (
              <div 
                key={item.cart_id} 
                onClick={() => setActiveItemIndex(index)}
                className={`flex justify-between items-center p-3 rounded border cursor-pointer transition-colors ${isActive ? 'bg-emerald-900/40 border-emerald-500/50' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'}`}
              >
                <div className="flex-1">
                  <div className={`font-medium ${isActive ? 'text-emerald-400' : 'text-white'}`}>{item.name}</div>
                  <div className="text-sm text-slate-400">{item.barcode}</div>
                  {item.discount > 0 && (
                    <div className="text-xs text-red-400 mt-1">Discount: -EGP {item.discount.toFixed(2)}</div>
                  )}
                </div>
                
                <div className="flex items-center space-x-6">
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-3 bg-slate-900/80 rounded-lg p-1 border border-slate-700/50">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDecrease(item.cart_id, item.quantity); }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-mono font-bold text-lg min-w-[2ch] text-center">
                      {item.quantity}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleIncrease(item.cart_id, item.quantity); }}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  {/* Price Info */}
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm text-slate-400">{item.unit} x EGP {item.unit_price.toFixed(2)}</div>
                    <div className="font-bold text-lg text-white">
                      EGP {((item.quantity * item.unit_price) - item.discount).toFixed(2)}
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
