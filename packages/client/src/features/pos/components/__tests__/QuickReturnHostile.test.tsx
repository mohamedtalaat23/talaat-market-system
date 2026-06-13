import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { QuickReturnWorkspace } from '../QuickReturnWorkspace';
import { ManagerApproveCommitModal } from '../../dashboard/components/ManagerApproveCommitModal';
import { POSKeyboardHandler } from '../POSKeyboardHandler';
import { useModalStore } from '@/stores/modalStore';
import { apiClient } from '@/services/api-client';

// Mock API Client
jest.mock('@/services/api-client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn()
  }
}));

describe('Hostile Quick Return UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useModalStore.setState({
      activeModals: { pos_quick_return: false } as any
    });
  });

  describe('HUI-1: Queue Multiplication (Scanner Burst)', () => {
    it('only creates exactly one queue even if 50 scans fire in 100ms', async () => {
      // Setup
      useModalStore.setState({
        activeModals: { pos_quick_return: true } as any
      });
      (apiClient.post as jest.Mock).mockImplementation((url) => {
        if (url === '/return-queues') {
           return new Promise(resolve => setTimeout(() => resolve({ data: { data: { queue_id: 'q123' } } }), 50));
        }
        return Promise.resolve({ data: { success: true }});
      });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: { id: 'p1', name: 'Pepsi', selling_price: 10 } } });

      render(<QuickReturnWorkspace />);

      // Simulate 50 concurrent scanner captures hitting useScannerDetection
      const scanPromises = [];
      for (let i = 0; i < 50; i++) {
         // Fire keydown events rapidly to trigger scanner detection
         fireEvent.keyDown(window, { key: '1' });
         fireEvent.keyDown(window, { key: '2' });
         fireEvent.keyDown(window, { key: 'Enter' });
      }

      await waitFor(() => {
         // Should only call /return-queues EXACTLY once due to queueInitPromiseRef lock
         const queueCreates = (apiClient.post as jest.Mock).mock.calls.filter(c => c[0] === '/return-queues');
         expect(queueCreates.length).toBe(1);
      });
    });
  });

  describe('HUI-3: Scanner Bleed (Global Focus Trap)', () => {
    it('blocks POSKeyboardHandler handleScan if activeModals has any true value', () => {
      useModalStore.setState({ activeModals: { pos_quick_return: true } as any });
      
      render(<POSKeyboardHandler />);
      
      // Simulate scan that bleeds into background
      fireEvent.keyDown(window, { key: '9' });
      fireEvent.keyDown(window, { key: 'Enter' });

      // POSKeyboardHandler handleScan should immediately return due to activeModals check
      expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/products/barcode/'));
    });
  });

  describe('HUI-4: Approve/Commit Deadlock (Resumable State Flow)', () => {
    it('commits directly without approving if queue is already APPROVED', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ 
        data: { data: { queue_id: 'q123', state: 'APPROVED', items: [] } } 
      });

      const { getByText, getByRole } = render(
        <ManagerApproveCommitModal queueId="q123" onClose={() => {}} />
      );

      await waitFor(() => expect(getByText(/Commit Only/i)).toBeInTheDocument());

      // Click the Commit Only button
      const commitBtn = getByText(/Commit Only/i);
      fireEvent.click(commitBtn);

      await waitFor(() => {
        expect(apiClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/approve'), expect.anything());
        expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining('/commit'));
      });
    });
  });

  describe('HUI-6: Stale Queue Handling', () => {
    it('auto-closes modal if queue is already COMMITTED', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ 
        data: { data: { queue_id: 'q123', state: 'COMMITTED', items: [] } } 
      });

      const handleClose = jest.fn();
      render(<ManagerApproveCommitModal queueId="q123" onClose={handleClose} />);

      await waitFor(() => {
         expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('HUI-7: Modal Spam (Idempotent F10)', () => {
    it('does not open multiple workspaces if F10 is spammed', () => {
      const openModalSpy = jest.spyOn(useModalStore.getState(), 'openModal');
      useModalStore.setState({ activeModals: { pos_quick_return: true } as any });

      render(<POSKeyboardHandler />);

      fireEvent.keyDown(window, { key: 'F10' });
      fireEvent.keyDown(window, { key: 'F10' });

      expect(openModalSpy).not.toHaveBeenCalledWith('pos_quick_return');
    });
  });
});
