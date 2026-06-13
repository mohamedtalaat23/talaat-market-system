import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Archive, DollarSign } from 'lucide-react';

interface Props {
  queueId: string;
  onClose: () => void;
}

export function ManagerApproveCommitModal({ queueId, onClose }: Props) {
  const [queue, setQueue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await apiClient.get(`/return-queues/${queueId}`);
        const q = res.data?.data;
        
        // HUI-6: Stale Queue Handling
        if (q.state === 'COMMITTED' || q.state === 'CANCELLED') {
          toast.success(`Queue is already ${q.state}`);
          onClose();
          return;
        }
        
        // Pre-check verification if already approved (HUI-4)
        if (q.state === 'APPROVED') {
           setVerified(true);
        }

        setQueue(q);
      } catch (e: any) {
        toast.error('Failed to load queue details');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, [queueId, onClose]);

  const handleApproveAndCommit = async () => {
    if (!verified) {
      toast.error('You must physically verify the items');
      return;
    }

    setIsCommitting(true);
    try {
      // HUI-4: Resumable State Flow
      // Only fire approve if it's currently SUBMITTED
      if (queue.state === 'SUBMITTED') {
        await apiClient.post(`/return-queues/${queueId}/approve`, {
          return_condition_verified: true
        });
        setQueue((prev: any) => ({ ...prev, state: 'APPROVED' }));
      }

      // Proceed to Commit
      await apiClient.post(`/return-queues/${queueId}/commit`);
      
      toast.success('Return Approved and Committed successfully');
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Transaction failed');
      setIsCommitting(false);
    }
  };

  if (loading || !queue) return null;

  const totalRefund = queue.items?.reduce((acc: number, i: any) => acc + (i.unit_price * i.quantity), 0) || 0;
  const restockCount = queue.items?.filter((i: any) => i.disposition === 'RESTOCK').reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
  const writeoffCount = queue.items?.filter((i: any) => i.disposition === 'NON_RESTOCKABLE').reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-border bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Approve & Commit Return</h2>
            <p className="text-sm text-slate-500 mt-1">Queue ID: {queueId}</p>
          </div>
          <button onClick={onClose} disabled={isCommitting} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600"><DollarSign className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Refund</p>
                <p className="text-2xl font-black text-indigo-700">EGP {totalRefund.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600"><Archive className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Restock</p>
                <p className="text-2xl font-black text-emerald-700">{restockCount} items</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-lg text-rose-600"><AlertTriangle className="w-6 h-6" /></div>
              <div>
                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Write-off</p>
                <p className="text-2xl font-black text-rose-700">{writeoffCount} items</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Items Overview</h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-border text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-semibold">SKU / Item</th>
                    <th className="py-3 px-4 font-semibold text-center">Qty</th>
                    <th className="py-3 px-4 font-semibold text-right">Unit Price</th>
                    <th className="py-3 px-4 font-semibold">Disposition</th>
                    <th className="py-3 px-4 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{item.sku_id}</td>
                      <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                      <td className="py-3 px-4 text-right">EGP {Number(item.unit_price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.disposition === 'RESTOCK' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {item.disposition}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.non_restock_reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <div className="p-6 border-t border-border bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={verified} 
              onChange={(e) => setVerified(e.target.checked)}
              disabled={isCommitting || queue.state === 'APPROVED'}
              className="w-6 h-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 focus:ring-2 disabled:opacity-50 transition-all cursor-pointer"
            />
            <span className="text-slate-700 font-semibold select-none group-hover:text-slate-900 transition-colors text-lg">
              Physical items verified {queue.state === 'APPROVED' ? '(Already Approved)' : ''}
            </span>
          </label>
          
          <button
            onClick={handleApproveAndCommit}
            disabled={!verified || isCommitting}
            className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-lg"
          >
            {isCommitting ? 'Processing...' : queue.state === 'APPROVED' ? 'Commit Only' : 'Approve & Commit'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
