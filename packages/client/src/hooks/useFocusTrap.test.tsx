import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useFocusTrap } from './useFocusTrap';
function Dialog() {
  const ref = useFocusTrap(true);
  return (
    <div ref={ref}>
      <input aria-label="Quantity" />
      <input aria-label="Reason" />
    </div>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('does not steal focus from an operator who entered another dialog field before autofocus', () => {
  let autofocus!: FrameRequestCallback;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    autofocus = callback;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  render(<Dialog />);
  const reason = screen.getByLabelText('Reason');
  reason.focus();
  autofocus(0);
  expect(document.activeElement).toBe(reason);
});
it('focuses the first input when focus is still outside the new dialog', () => {
  let autofocus!: FrameRequestCallback;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    autofocus = callback;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  render(<Dialog />);
  autofocus(0);
  expect(document.activeElement).toBe(screen.getByLabelText('Quantity'));
});
