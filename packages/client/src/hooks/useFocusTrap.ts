import { useEffect, useRef } from 'react';

/**
 * A custom hook to trap focus within a container element for accessibility (WAI-ARIA).
 * When active, tabbing past the last focusable element wraps focus back to the first,
 * and shift-tabbing past the first wraps focus to the last.
 * It also automatically focuses the first focusable element (or first input) on mount,
 * and restores focus to the previously active element upon unmount.
 *
 * @param isOpen Indicates whether the modal/trap container is active.
 * @returns A React Ref to be attached to the modal/dialog container.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(isOpen: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // List of standard focusable selectors
    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'button:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[tabindex="0"]',
      '[contenteditable]',
    ];

    const getFocusableElements = (): HTMLElement[] => {
      const elements = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors.join(','))
      );
      // Filter out elements that are hidden (e.g. display: none or parent visibility: hidden)
      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    };

    // Store the element that triggered the modal to restore focus later
    const previousActiveElement = document.activeElement as HTMLElement;

    // Focus the first appropriate element inside the modal with a small micro-task delay
    const timer = setTimeout(() => {
      const freshFocusable = getFocusableElements();
      if (freshFocusable.length > 0) {
        // Prefer focusing the first input element for form usability
        const firstInput = freshFocusable.find((el) => el.tagName === 'INPUT');
        if (firstInput) {
          firstInput.focus();
        } else {
          freshFocusable[0]?.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const activeFocusable = getFocusableElements();
      if (activeFocusable.length === 0) return;

      const first = activeFocusable[0];
      const last = activeFocusable[activeFocusable.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: Wrap backwards from first to last
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        // Tab: Wrap forwards from last to first
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the element that triggered the dialog
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  return containerRef;
}
