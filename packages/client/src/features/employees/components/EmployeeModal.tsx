import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, UserCog } from 'lucide-react';
import { EmployeeForm } from './EmployeeForm';
import { useCreateEmployee, useUpdateEmployee } from '../hooks/useEmployeeQueries';
import toast from 'react-hot-toast';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * EmployeeModal overlay.
 * Uses useModalStore to decouple triggers and parameters.
 * Implements WAI-ARIA and focus trapping for accessibility.
 */
export function EmployeeModal() {
  const { t } = useTranslation();
  const isOpen = useModalStore((state) => state.activeModals.employee_form);
  const payload = useModalStore((state) => state.modalPayloads.employee_form);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const closeModal = () => closeModalAction('employee_form');

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const employee = payload?.employee;
  const mode = payload?.mode || 'create';

  // Escape key closes modal
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

  const handleSubmit = async (formData: any) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(formData);
        toast.success(t('employees.createSuccess'));
      } else if (mode === 'edit' && employee) {
        await updateMutation.mutateAsync({
          id: employee.id,
          data: formData,
        });
        toast.success(t('employees.updateSuccess'));
      }
      closeModal();
    } catch (error: any) {
      // Expose generic errors rather than detailed leaks
      const message = error.message || 'Operation failed. Verify parameters.';
      if (message.toLowerCase().includes('username')) {
        toast.error(t('employees.usernameTaken'));
      } else {
        toast.error(message);
      }
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-text">
      {/* Backdrop click close */}
      <div
        className="absolute inset-0"
        onClick={isSaving ? undefined : closeModal}
        aria-hidden="true"
      />

      {/* Modal Box */}
      <div
        ref={focusTrapRef}
        className="w-full max-w-2xl rounded-xl border-none bg-card text-foreground p-6 shadow-2xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 -mx-6 -mt-6 mb-6 rounded-t-xl select-none">
          <h3 id="employee-modal-title" className="text-lg font-bold text-primary flex items-center gap-2">
            {mode === 'create' ? <UserPlus className="w-5 h-5" /> : <UserCog className="w-5 h-5" />}
            {mode === 'create'
              ? t('employees.registerTitle')
              : t('employees.editTitle').replace('{name}', employee?.full_name || '')}
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

        <EmployeeForm
          initialData={employee}
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
export default EmployeeModal;
