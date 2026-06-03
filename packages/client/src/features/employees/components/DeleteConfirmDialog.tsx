import { useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useDeleteEmployee } from '../hooks/useEmployeeQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * DeleteConfirmDialog overlay.
 * Uses useModalStore to decouple triggers and parameters.
 * Implements WAI-ARIA and focus trapping for accessibility.
 */
export function DeleteConfirmDialog() {
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
      toast.success('Employee account deactivated and removed');
      closeModal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to soft delete employee');
    }
  };

  const isDeleting = deleteMutation.isPending;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4 select-text">
      {/* Backdrop click close */}
      <div 
        className="absolute inset-0" 
        onClick={isDeleting ? undefined : closeModal} 
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-md rounded-lg border border-destructive/20 bg-input p-6 shadow-xl relative z-10 animate-fade-in text-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-delete-confirm-title"
        aria-describedby="emp-delete-confirm-desc"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>

        <h3 id="emp-delete-confirm-title" className="text-lg font-bold text-foreground mb-2 select-none">
          Deactivate & Remove Account
        </h3>

        <p id="emp-delete-confirm-desc" className="text-sm text-secondary mb-6 leading-relaxed">
          Are you sure you want to delete <strong className="text-foreground">{employee.full_name}</strong>? 
          This will soft-delete and deactivate their access. They will no longer be able to log in or operate cash registers, but historical sale logs will be preserved.
        </p>

        <div className="flex justify-end space-x-2 border-t border-border pt-4 mt-6 select-none">
          <Button
            variant="outline"
            onClick={closeModal}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center space-x-1.5 font-semibold focus-visible:ring-2 focus-visible:ring-destructive"
          >
            {isDeleting ? (
              <>
                <Spinner size="sm" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Confirm Delete</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
export default DeleteConfirmDialog;
