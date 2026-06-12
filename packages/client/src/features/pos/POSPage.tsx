import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOSStore } from './usePOSStore';
import { apiClient } from '@/services/api-client';
import { POSCartList } from './components/POSCartList';
import { POSSummary } from './components/POSSummary';
import { POSTopBar } from './components/POSTopBar';
import { POSKeyboardHandler } from './components/POSKeyboardHandler';
import { ProductSearchFallback } from './components/ProductSearchFallback';
import { ManagerOverrideModal } from './components/ManagerOverrideModal';
import { PaymentModal } from './components/PaymentModal';
import { DiscountModal } from './components/DiscountModal';
import { SuspendedCartsModal } from './components/SuspendedCartsModal';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { NoShiftOverlay } from './components/NoShiftOverlay';
import { OpenShiftModal } from './components/OpenShiftModal';
import { CloseShiftModal } from './components/CloseShiftModal';
import TransactionSearchModal from './components/TransactionSearchModal';
import { RefundModal } from './components/RefundModal';
import { DrawerAdjustmentModal } from './components/DrawerAdjustmentModal';
import { CustomerSelectModal } from './components/CustomerSelectModal';
import { QuantityModal } from './components/QuantityModal';
import { useModalStore } from '@/stores/modalStore';
import { PrintQueueMonitor } from './components/PrintQueueMonitor';
import { useShiftHeartbeat } from './hooks/useShiftHeartbeat';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { FastPinLockscreen } from './components/FastPinLockscreen';
import toast from 'react-hot-toast';

export function POSPage() {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
  const addItem = usePOSStore((state) => state.addItem);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Expose stores to window for E2E testing inspection/control
  useEffect(() => {
    (window as any).__modalStore = useModalStore;
    (window as any).__posStore = usePOSStore;
  }, [openModal]);

  // Trigger Manager PIN override popup on mount before unlocking page
  useEffect(() => {
    openModal('pos_manager_override', {
      action: 'enter_pos',
      onCancel: () => {
        navigate('/');
      },
    });
  }, [openModal, navigate]);

  // Open transaction search modal on mount if specified in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('modal') === 'transaction_search') {
      openModal('pos_transaction_search');
    }
  }, [openModal]);

  // Activate shift heartbeat validation poller
  useShiftHeartbeat();

  // Use stable selectors for performance
  const cart = usePOSStore((state) => state.cart);
  const paymentMethod = usePOSStore((state) => state.paymentMethod);
  const cashReceived = usePOSStore((state) => state.cashReceived);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const activeModals = useModalStore((state) => state.activeModals);
  const closeModal = useModalStore((state) => state.closeModal);
  const idleTimeoutMs = usePOSStore((state) => state.idleTimeoutMs);

  // Initialize auto-lock idle timer
  const { isIdle, resetTimer, setIsIdle } = useIdleTimer(idleTimeoutMs);

  useEffect(() => {
    const handleManualLock = () => setIsIdle(true);
    window.addEventListener('pos:manual-lock', handleManualLock);
    return () => window.removeEventListener('pos:manual-lock', handleManualLock);
  }, [setIsIdle]);

  // Scanner flash effect when an item is added to the cart
  const cartLength = cart.length;
  const prevCartLengthRef = useRef(cartLength);
  const [scannerFlash, setScannerFlash] = useState(false);

  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      setScannerFlash(true);
      const timer = setTimeout(() => setScannerFlash(false), 150);
      return () => clearTimeout(timer);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart.length]);

  useEffect(() => {
    // Fetch active shift on mount
    const fetchShift = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: any }>(
          '/pos/shifts/current',
        );
        if (response.data?.success) {
          setActiveShift(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch current shift', error);
        setActiveShift(null);
      }
    };
    fetchShift();
  }, []);

  // Auto-focus search input on mount and global Esc/F5 presses
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Focus search bar on Escape (except inside a modal)
      const hasActiveModal = Object.values(useModalStore.getState().activeModals).some(isOpen => isOpen);
      if (e.key === 'Escape' && !hasActiveModal) {
        searchInputRef.current?.focus();
      }
      // Focus search bar on F5 instead of refreshing
      if (e.key === 'F5' && !hasActiveModal) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim();
    setSearchQuery('');

    // Check if no shift is open before looking up product
    if (!usePOSStore.getState().activeShift) {
      toast.error('Cannot look up product when shift is closed');
      return;
    }

    const loadingToastId = toast.loading(`Looking up: "${query}"`);
    try {
      // 1. Try exact barcode match first
      const response = await apiClient.get<{ success: boolean; data: any }>(
        `/products/barcode/${query}`,
      );
      toast.dismiss(loadingToastId);

      if (response.data?.success && response.data?.data) {
        const product = response.data.data;
        if (!product.is_active) {
          toast.error(`Product "${product.name}" is inactive`);
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
          inventory_quantity: product.inventory_quantity || 0,
        });
        toast.success(`Added ${product.name}`);
        searchInputRef.current?.focus();
        return;
      }
    } catch (error) {
      // Barcode scan failed, fall back to searching products catalog modal
      toast.dismiss(loadingToastId);
    }

    // 2. Open search modal with query if not found by barcode
    openModal('pos_product_search', { initialSearch: query });
  };

  return (
    <div
      className={`flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none transition-colors duration-fast ${
        scannerFlash ? 'animate-scanner-flash' : ''
      }`}
    >
      <FastPinLockscreen isOpen={isIdle} onSuccess={resetTimer} />
      
      <POSTopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Cart & Table (70% - Edge-to-Edge data display) */}
        <div className="w-[70%] flex flex-col border-r border-border bg-neutral-50 overflow-hidden">
          {/* Persistent Scan & Lookup Input Bar */}
          <form onSubmit={handleSearchSubmit} className="p-3 bg-white border-b border-border shrink-0">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or type name to search... (F5)"
                className="w-full bg-neutral-100 border border-border text-sm text-foreground placeholder-neutral-500 px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded font-mono select-text"
              />
              <div className="absolute right-3 top-2.5 text-xs font-mono font-bold text-neutral-500 border border-neutral-300 bg-white px-1.5 py-0.5 rounded">
                ENTER
              </div>
            </div>
          </form>

          {/* Receipt Data Table */}
          <POSCartList />
        </div>

        {/* Right Panel: Summary & Quick Numpad Actions (30%) */}
        <div className="w-[30%] flex flex-col bg-white overflow-hidden h-full">
          <POSSummary cart={cart} paymentMethod={paymentMethod} cashReceived={cashReceived} />
          <PrintQueueMonitor />
        </div>
      </div>

      {/* Invisible global keyboard listener for shortcuts and barcode scanning */}
      <POSKeyboardHandler />

      {/* Overlays */}
      <NoShiftOverlay />
      <OpenShiftModal />
      <CloseShiftModal />
      <TransactionSearchModal />
      <RefundModal />
      <DrawerAdjustmentModal />
      <ProductSearchFallback />
      <ManagerOverrideModal />
      <PaymentModal />
      <DiscountModal />
      <SuspendedCartsModal />
      <ReceiptPreviewModal />
      <QuantityModal />
      <CustomerSelectModal
        isOpen={activeModals.pos_customer_select}
        onClose={() => closeModal('pos_customer_select')}
      />
    </div>
  );
}

export default POSPage;
