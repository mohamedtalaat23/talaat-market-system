import { useEffect, useRef } from 'react';

interface ShortcutOptions {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enableOnInputs?: boolean;
}

/**
 * Custom hook to register a global keydown shortcut handler.
 *
 * Supports modifier checks (Ctrl/Meta/Shift/Alt) and handles input focus gating by default.
 *
 * @param keySpec The key value to match (e.g., 'F5', 'Enter', 'k' or combined keys)
 * @param callback The trigger callback to invoke
 * @param options Behavior filters (e.g. preventDefault, stopPropagation, enableOnInputs)
 */
export function useGlobalShortcut(
  keySpec: string | string[],
  callback: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const { preventDefault = false, stopPropagation = false, enableOnInputs = false } = options;
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Gating for input focus
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (isInput && !enableOnInputs) {
        return; // Ignore shortcuts if user is typing
      }

      // 2. Match key specification
      const targetKeys = Array.isArray(keySpec) ? keySpec : [keySpec];
      const matches = targetKeys.some((k) => {
        // Simple string matches for F-keys or single keys
        if (k.toLowerCase() === e.key.toLowerCase()) return true;
        return false;
      });

      if (matches) {
        if (preventDefault) {
          e.preventDefault();
        }
        if (stopPropagation) {
          e.stopPropagation();
        }
        callbackRef.current(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keySpec, preventDefault, stopPropagation, enableOnInputs]);
}

export default useGlobalShortcut;
