import { useEffect } from 'react';
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
import { CustomerSelectModal } from './components/CustomerSelectModal';
import { QuantityModal } from './components/QuantityModal';
import { useModalStore } from '@/stores/modalStore';
import { PrintQueueMonitor } from './components/PrintQueueMonitor';
import { useShiftHeartbeat } from './hooks/useShiftHeartbeat';

export function POSPage() {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);

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

  // Activate shift heartbeat validation poller
  useShiftHeartbeat();

  // Use stable selectors for performance
  const cart = usePOSStore((state) => state.cart);
  const paymentMethod = usePOSStore((state) => state.paymentMethod);
  const cashReceived = usePOSStore((state) => state.cashReceived);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const activeModals = useModalStore((state) => state.activeModals);
  const closeModal = useModalStore((state) => state.closeModal);

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

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none">
      <POSTopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Cart (70% approximation) */}
        <div className="w-8/12 flex flex-col border-r rtl:border-r-0 rtl:border-l border-border bg-card/40">
          <POSCartList />
        </div>

        {/* Right Panel: Summary & Actions (30% approximation) */}
        <div className="w-4/12 flex flex-col bg-sidebar p-4 space-y-4 justify-between h-full overflow-y-auto">
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
