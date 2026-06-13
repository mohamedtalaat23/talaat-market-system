import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ProductForm } from './ProductForm';
import { useCreateProduct, useUpdateProduct } from '../hooks/useProductQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * ProductModal overlay.
 * Uses useModalStore to decouple triggers and parameters.
 * Implements WAI-ARIA role structures and useFocusTrap for keyboard accessibility.
 */
export function ProductModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.product_form);
  const payload = useModalStore((state) => state.modalPayloads.product_form);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('product_form');

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Close modal on Escape key press
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

  if (!isOpen) return null;

  const product = payload?.product;
  const mode = payload?.mode || 'create';

  const handleSubmit = async (formData: any) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
        toast.success(t('products.productCreated'));
      } else if (mode === 'edit' && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: formData,
        });
        toast.success(t('products.productUpdated'));
      }
      closeModal();
    } catch (error: any) {
      toast.error(error.message || t('products.failedSave'));
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 select-text">
      {/* Backdrop closer click hook */}
      <div
        className="absolute inset-0"
        onClick={isSaving ? undefined : closeModal}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl rounded-2xl border border-border/50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.7)] relative z-10 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-6">
          <h3 id="product-modal-title" className="text-2xl font-black text-foreground tracking-tight">
            {mode === 'create' ? t('products.addProduct') : `${t('common.edit')}: ${product?.name}`}
          </h3>
          <button
            onClick={closeModal}
            disabled={isSaving}
            className="rounded-full p-2 text-secondary hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t('products.closeModal')}
          >
            <X size={20} />
          </button>
        </div>

        <ProductForm
          initialData={product}
          onSubmit={handleSubmit}
          isLoading={isSaving}
          mode={mode}
          onCancel={closeModal}
        />
      </div>
    </div>,
    document.body
  );
}
export default ProductModal;
