import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import TransactionSearchModal from '../TransactionSearchModal';
import { useModalStore } from '@/stores/modalStore';
import { apiClient } from '@/services/api-client';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const getMock = vi.mocked(apiClient.get);

const setOpen = (open: boolean) => {
  act(() => {
    useModalStore.setState((state) => ({
      activeModals: { ...state.activeModals, pos_transaction_search: open },
    }));
  });
};

describe('TransactionSearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ data: { success: true, data: [] } } as never);
  });

  it('renders nothing while the modal is closed', async () => {
    setOpen(false);
    render(<TransactionSearchModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Regression test: the component used to early-return before declaring
  // `showSpinner` state + its effect, so mounting closed and then opening
  // threw "Rendered more hooks than during the previous render".
  it('opens after having been mounted closed without violating hook order', async () => {
    setOpen(false);
    render(<TransactionSearchModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    setOpen(true);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('pos.transactionSearchTitle')).toBeInTheDocument();
  });

  it('loads the latest transactions when opened', async () => {
    setOpen(false);
    render(<TransactionSearchModal />);
    setOpen(true);

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith('/pos/sales/search?q=');
    });
  });

  it('shows the empty state when no transactions match', async () => {
    setOpen(false);
    render(<TransactionSearchModal />);
    setOpen(true);

    expect(await screen.findByText('pos.noTransactionsFound')).toBeInTheDocument();
  });

  it('removes the dialog again when closed', async () => {
    setOpen(false);
    render(<TransactionSearchModal />);
    setOpen(true);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    setOpen(false);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

