import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { useTranslation } from '@/hooks/useTranslation';

interface ConfirmDialogProps {
  title: string;
  description: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native modal semantics make the rest of the app inert and contain keyboard focus. */
export function ConfirmDialog({
  title,
  description,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { language } = useTranslation();
  const ar = language === 'ar';
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-busy={busy}
      onKeyDown={(event) => event.stopPropagation()}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-lg border border-border bg-card text-foreground p-6 shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="my-4 text-sm text-secondary">
        {description}
      </p>
      {error && (
        <p role="alert" className="my-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={busy} autoFocus>
          {ar ? 'رجوع' : 'Go back'}
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'تأكيد' : 'Confirm'}
        </Button>
      </div>
    </dialog>,
    document.body,
  );
}
