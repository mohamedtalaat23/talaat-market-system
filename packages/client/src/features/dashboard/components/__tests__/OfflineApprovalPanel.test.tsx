import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { OfflineApprovalPanel } from '../OfflineApprovalPanel';
vi.mock('@/services/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const row = {
  id: 2,
  cashier_id: 3,
  reason: 'OFFLINE_PRICE_APPROVAL_REQUIRED',
  detail: 'Price needs approval',
  created_at: new Date().toISOString(),
  payload: { items: [{ product_id: 4, quantity: 1, unit_price: 8, discount: 0 }] },
};
function mount() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OfflineApprovalPanel />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: 7, username: 'manager', role: 'manager' } });
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [row] } });
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
});
it('does not fetch the manager queue for a cashier', () => {
  useAuthStore.setState({ user: { id: 3, username: 'cashier', role: 'cashier' } });
  mount();
  expect(apiClient.get).not.toHaveBeenCalled();
});
it('requires the logged-in manager PIN and preserves the review on failure', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Invalid PIN'));
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByText('offlineApproval.review'));
  await user.type(screen.getByLabelText('offlineApproval.pin'), '482913');
  await user.click(screen.getByText('offlineApproval.confirm'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid PIN');
  expect(apiClient.post).toHaveBeenCalledWith(
    '/pos/sync/quarantine/2/resolve',
    expect.objectContaining({ manager_id: 7, manager_pin: '482913', decision: 'approve' }),
  );
  expect(screen.getByText('Price needs approval')).toBeInTheDocument();
});
