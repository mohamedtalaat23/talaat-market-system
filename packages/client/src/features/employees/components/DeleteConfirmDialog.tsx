import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useDeleteEmployee } from '../hooks/useEmployeeQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * DeleteConfirmDialog overlay.
 * Uses useModalStore to decouple triggers and parameters.
 * Implements WAI-ARIA and focus trapping for accessibility.
 */
export function DeleteConfirmDialog() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.employee_delete);
  const payload = useModalStore((state) => state.modalPayloads.employee_delete);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('employee_delete');

  const deleteMutation = useDeleteEmployee();
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

  const employee = payload;

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(employee.id);
      toast.success(t('employees.deleteSuccess'));
      closeModal();
    } catch (error: any) {
      toast.error(error.message || t('employees.deleteFailed'));
    }
  };

  const isDeleting = deleteMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-text">
      {/* Backdrop click close */}
      <div
        className="absolute inset-0"
        onClick={isDeleting ? undefined : closeModal}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-md bg-card border border-border/40 rounded-3xl shadow-2xl shadow-black/20 relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden text-center p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-delete-confirm-title"
        aria-describedby="emp-delete-confirm-desc"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 text-destructive mb-6 shadow-inner">
          <AlertTriangle className="h-10 w-10" aria-hidden="true" />
        </div>

        <h3
          id="emp-delete-confirm-title"
          className="text-2xl font-black tracking-tight text-foreground mb-3 select-none"
        >
          {t('employees.deleteTitle')}
        </h3>

        <p
          id="emp-delete-confirm-desc"
          className="text-sm font-medium text-secondary mb-8 leading-relaxed px-4"
        >
          {t('employees.deleteDesc').replace('{name}', employee.full_name)}
        </p>

        <div className="flex gap-3 pt-2 select-none">
          <button
            onClick={closeModal}
            disabled={isDeleting}
            className="flex-1 py-3.5 bg-card hover:bg-muted text-foreground font-bold rounded-xl border border-border/60 shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-3.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-black uppercase tracking-widest text-[11px] rounded-xl shadow-md shadow-destructive/20 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" />
                <span>{t('employees.deactivated')}</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>{t('employees.remove')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export default DeleteConfirmDialog;
