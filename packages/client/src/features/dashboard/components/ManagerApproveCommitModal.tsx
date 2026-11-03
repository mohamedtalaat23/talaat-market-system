import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Archive, DollarSign } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  queueId: string;
  onClose: () => void;
}

export function ManagerApproveCommitModal({ queueId, onClose }: Props) {
  const { t } = useTranslation();
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
          toast.success(t('dashboard.returns.toastStale').replace('{state}', q.state));
          onClose();
          return;
        }

        // Pre-check verification if already approved (HUI-4)
        if (q.state === 'APPROVED') {
          setVerified(true);
        }

        setQueue(q);
      } catch {
        toast.error(t('dashboard.returns.toastLoadFailed'));
        onClose();
      } finally {
        setLoading(false);
      }
    };
    void fetchQueue();
  }, [queueId, onClose, t]);

  const handleApproveAndCommit = async () => {
    if (!verified) {
      toast.error(t('dashboard.returns.toastVerifyRequired'));
      return;
    }

    setIsCommitting(true);
    try {
      // HUI-4: Resumable State Flow
      // Only fire approve if it's currently SUBMITTED
      if (queue.state === 'SUBMITTED') {
        await apiClient.post(`/return-queues/${queueId}/approve`, {
          return_condition_verified: true,
        });
        setQueue((prev: any) => ({ ...prev, state: 'APPROVED' }));
      }

      // Proceed to Commit
      await apiClient.post(`/return-queues/${queueId}/commit`);

      toast.success(t('dashboard.returns.toastSuccess'));
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || t('dashboard.returns.toastFailed'));
      setIsCommitting(false);
    }
  };

  if (loading || !queue) return null;

  const totalRefund =
    queue.items?.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0) || 0;
  const restockCount =
    queue.items
      ?.filter((i: any) => i.disposition === 'RESTOCK')
      .reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
  const writeoffCount =
    queue.items
      ?.filter((i: any) => i.disposition === 'NON_RESTOCKABLE')
      .reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t('dashboard.returns.modalTitle')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {t('dashboard.returns.queueId').replace('{id}', queueId)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  {t('dashboard.returns.totalRefund')}
                </p>
                <p className="text-2xl font-semibold text-indigo-700">
                  {t('dashboard.returns.refundValue').replace('{amount}', totalRefund.toFixed(2))}
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  {t('dashboard.returns.restock')}
                </p>
                <p className="text-2xl font-semibold text-emerald-700">
                  {t('dashboard.returns.restockCount').replace('{count}', String(restockCount))}
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-lg text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                  {t('dashboard.returns.writeoff')}
                </p>
                <p className="text-2xl font-semibold text-rose-700">
                  {t('dashboard.returns.writeoffCount').replace('{count}', String(writeoffCount))}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
              {t('dashboard.returns.itemsOverview')}
            </h3>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left rtl:text-right text-sm">
                <thead className="bg-slate-50 border-b border-border text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-semibold">{t('dashboard.returns.tableSku')}</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      {t('dashboard.returns.tableQty')}
                    </th>
                    <th className="py-3 px-4 font-semibold text-right rtl:text-left">
                      {t('dashboard.returns.tableUnitPrice')}
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      {t('dashboard.returns.tableDisposition')}
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      {t('dashboard.returns.tableReason')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{item.sku_id}</td>
                      <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                      <td className="py-3 px-4 text-right rtl:text-left">
                        {t('dashboard.returns.refundValue').replace(
                          '{amount}',
                          Number(item.unit_price || 0).toFixed(2),
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${item.disposition === 'RESTOCK' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                        >
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
              {t('dashboard.returns.physicalVerified')}{' '}
              {queue.state === 'APPROVED' ? t('dashboard.returns.alreadyApproved') : ''}
            </span>
          </label>

          <button
            onClick={handleApproveAndCommit}
            disabled={!verified || isCommitting}
            className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-lg"
          >
            {isCommitting
              ? t('dashboard.returns.btnProcessing')
              : queue.state === 'APPROVED'
                ? t('dashboard.returns.btnCommitOnly')
                : t('dashboard.returns.btnApproveCommit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
