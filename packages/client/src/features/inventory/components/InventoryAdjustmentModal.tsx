import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { InventoryAdjustmentForm } from './InventoryAdjustmentForm';
import { useAdjustStock } from '../hooks/useInventoryQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * InventoryAdjustmentModal overlay.
 * Uses useModalStore to decouple opening states.
 * Implements WAI-ARIA and focus trapping for high accessibility.
 */
export function InventoryAdjustmentModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.inventory_adjust);
  const payload = useModalStore((state) => state.modalPayloads.inventory_adjust);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('inventory_adjust');

  const adjustMutation = useAdjustStock();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Close modal on Escape press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeModal]);

  if (!isOpen || !payload) return null;

  const item = payload;

  const handleSubmit = async (formData: {
    adjustment_type: any;
    quantity_change: number;
    notes: string;
  }) => {
    try {
      await adjustMutation.mutateAsync({
        product_id: item.product_id,
        adjustment_type: formData.adjustment_type,
        quantity_change: formData.quantity_change,
        notes: formData.notes,
      });

      toast.success(t('inventory.adjustSuccess'));
      closeModal();
    } catch (error: any) {
      toast.error(error.message || t('inventory.adjustFailed'));
    }
  };

  const isSaving = adjustMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 select-text">
      {/* Backdrop click close hook */}
      <div
        className="absolute inset-0"
        onClick={isSaving ? undefined : closeModal}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-lg rounded-lg border border-input-border bg-input-bg p-6 shadow-xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-modal-title"
      >
        <div className="flex items-center justify-between border-b border-input-border pb-3 mb-4 select-none">
          <h3 id="adjust-modal-title" className="text-lg font-bold text-input-text">
            {t('inventory.performAdjustment')}
          </h3>
          <button
            onClick={closeModal}
            disabled={isSaving}
            className="rounded-md p-1.5 text-secondary hover:text-input-text hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t('products.closeModal')}
          >
            <X size={18} />
          </button>
        </div>

        <InventoryAdjustmentForm
          item={item}
          onSubmit={handleSubmit}
          isLoading={isSaving}
          onCancel={closeModal}
        />
      </div>
    </div>,
    document.body
  );
}
export default InventoryAdjustmentModal;
