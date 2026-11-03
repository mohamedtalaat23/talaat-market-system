import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from './useTranslation';

/** One pending confirmation per owner; cancellation/unmount resolves without mutation. */
export function useConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const { language } = useTranslation();
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setMessage(null);
  }
  const confirm = (description: string) =>
    new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setMessage(description);
    });
  const confirmationDialog =
    message === null ? null : (
      <ConfirmDialog
        title={language === 'ar' ? 'تأكيد الإجراء' : 'Confirm action'}
        description={message}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    );
  return { confirm, confirmationDialog };
}
