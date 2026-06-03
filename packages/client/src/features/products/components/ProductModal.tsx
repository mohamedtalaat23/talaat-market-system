import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ProductForm } from './ProductForm';
import { useCreateProduct, useUpdateProduct } from '../hooks/useProductQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * ProductModal overlay.
 * Uses useModalStore to decouple triggers and parameters.
 * Implements WAI-ARIA role structures and useFocusTrap for keyboard accessibility.
 */
export function ProductModal() {
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
        toast.success('Product created successfully');
      } else if (mode === 'edit' && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: formData,
        });
        toast.success('Product updated successfully');
      }
      closeModal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
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
        className="w-full max-w-2xl rounded-lg border border-border bg-input p-6 shadow-xl relative z-10 animate-fade-in max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 id="product-modal-title" className="text-lg font-bold text-foreground">
            {mode === 'create' ? 'Add New Product' : `Edit Product: ${product?.name}`}
          </h3>
          <button
            onClick={closeModal}
            disabled={isSaving}
            className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close modal"
          >
            <X size={18} />
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
    </div>
  );
}
export default ProductModal;
