import { useEffect, useCallback } from 'react';
import { usePOSStore } from '../usePOSStore';
import { useScannerDetection } from '../hooks/useScannerDetection';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { printerService } from '../services/printer.service';

export function POSKeyboardHandler() {
  const addItem = usePOSStore((state) => state.addItem);
  const openModal = useModalStore((state) => state.openModal);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canExit = user?.role === 'admin' || user?.role === 'manager';

  // Scanner detection logic
  const handleScan = useCallback(async (barcode: string) => {
    if (!usePOSStore.getState().activeShift) return; // Block scanner if no shift

    const loadingToastId = toast.loading(`Looking up barcode: ${barcode}`);
    
    try {
      const response = await apiClient.get<{ success: boolean; data: any }>(`/products/barcode/${barcode}`);
      
      toast.dismiss(loadingToastId);

      if (response.data?.success && response.data?.data) {
        const product = response.data.data;
        
        // Handle inactive product
        if (!product.is_active) {
          toast.error(`Product "${product.name}" is inactive and cannot be sold`);
          return;
        }

        // Handle out-of-stock product
        if (product.inventory_quantity !== undefined && product.inventory_quantity <= 0) {
          toast.error(`Product "${product.name}" is out of stock`);
          return;
        }

        addItem({
          product_id: product.id,
          barcode: product.barcode,
          name: product.name,
          name_ar: product.name_ar,
          unit_price: product.selling_price,
          quantity: 1,
          discount: 0,
          unit: product.unit,
          inventory_quantity: product.inventory_quantity || 0
        });
        
        toast.success(`Added ${product.name} to cart`);
      } else {
        toast.error(`Barcode "${barcode}" not found. Opening search...`);
        openModal('pos_product_search', { initialSearch: barcode });
      }
    } catch (error: any) {
      toast.dismiss(loadingToastId);
      if (error.status === 404) {
        toast.error(`Barcode "${barcode}" not found. Opening search...`);
        openModal('pos_product_search', { initialSearch: barcode });
      } else {
        console.error('Failed to lookup product barcode:', error);
        toast.error(error.message || 'Error looking up barcode');
      }
    }
  }, [addItem, openModal]);

  // Hook up scanner detection with <30ms threshold
  useScannerDetection({ onScan: handleScan, timeThreshold: 30 });


  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = usePOSStore.getState();
      
      // Block all shortcuts if no active shift
      if (!state.activeShift) return;

      // Prevent browser default behaviors for F-keys
      if (e.key.startsWith('F')) {
        e.preventDefault();
      }

      // Handle Ctrl shortcuts first
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          const lastSaleId = state.lastSaleId;
          if (lastSaleId) {
            apiClient.get(`/pos/receipts/${lastSaleId}`)
              .then(res => {
                if (res.data?.success) {
                   printerService.printReceipt(res.data.data).then(() => {
                     apiClient.post(`/pos/receipts/${lastSaleId}/print`);
                   });
                }
              })
              .catch(() => toast.error('Failed to load last receipt for printing'));
          } else {
            toast.error('No recent receipt to print');
          }
          return;
        }

        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          const lastSaleId = state.lastSaleId;
          if (lastSaleId) {
            openModal('pos_manager_override', {
              action: 'reprint_receipt',
              onSuccess: async () => {
                 try {
                   await apiClient.post(`/pos/receipts/${lastSaleId}/reprint`);
                   const res = await apiClient.get(`/pos/receipts/${lastSaleId}`);
                   if (res.data?.success) {
                      printerService.printReceipt(res.data.data, true);
                   }
                 } catch (error) {
                   toast.error('Reprint failed');
                 }
              }
            });
          } else {
            toast.error('No recent receipt to reprint');
          }
          return;
        }
      }

      const cartLength = state.cart.length;

      switch (e.key) {
        case 'F1':
        case ' ':
          // Only capture Spacebar if not typing in an input field
          if (e.target === document.body) {
             e.preventDefault();
             openModal('pos_payment');
          }
          break;
        case 'F2':
          // We handle this via Enter or mouse now
          break;
        case 'F3':
          openModal('pos_discount');
          break;
        case 'F4':
          openModal('pos_suspended_carts');
          break;
        case 'F5':
          openModal('pos_product_search');
          break;
        case 'F6':
          openModal('pos_transaction_search');
          break;
        case 'F8':
          openModal('pos_manager_override', { action: 'void_transaction' });
          break;
        case 'F12':
          if (canExit) {
            navigate('/');
          } else {
            toast.error('Only administrators or managers can exit POS');
          }
          break;
        case 'ArrowUp':
          if (cartLength > 0 && e.target === document.body) {
            e.preventDefault();
            state.setActiveItemIndex(Math.max(0, state.activeItemIndex - 1));
          }
          break;
        case 'ArrowDown':
          if (cartLength > 0 && e.target === document.body) {
            e.preventDefault();
            state.setActiveItemIndex(Math.min(cartLength - 1, state.activeItemIndex + 1));
          }
          break;
        case 'Delete':
          if (cartLength > 0 && e.target === document.body) {
            e.preventDefault();
            const activeItem = state.cart[state.activeItemIndex];
            if (activeItem) state.removeItem(activeItem.cart_id);
          }
          break;
        case 'Enter':
          if (cartLength > 0 && e.target === document.body) {
            e.preventDefault();
            const activeItem = state.cart[state.activeItemIndex];
            if (activeItem) {
              const newQtyStr = window.prompt(`Enter new quantity for ${activeItem.name}:`, String(activeItem.quantity));
              const newQty = Number(newQtyStr);
              if (newQtyStr !== null && !isNaN(newQty) && newQty >= 0) {
                if (newQty === 0) {
                  state.removeItem(activeItem.cart_id);
                } else if (newQty > activeItem.inventory_quantity) {
                  toast.error(`Cannot exceed stock of ${activeItem.inventory_quantity}`);
                } else {
                  state.updateQuantity(activeItem.cart_id, newQty);
                }
              }
              // Restore focus
              setTimeout(() => document.body.focus(), 50);
            }
          }
          break;
        case 'Escape':
          // Focus body to ensure scanner works
          document.body.focus();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canExit, navigate, openModal]);

  // This is a logic-only component that manages focus and shortcuts globally
  return null;
}

