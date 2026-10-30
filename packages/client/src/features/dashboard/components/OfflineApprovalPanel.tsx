import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface QuarantinedSale {
  id: number;
  cashier_id: number;
  reason: string;
  detail: string;
  created_at: string;
  payload: {
    items: { product_id: number; quantity: number; unit_price: number; discount: number }[];
    global_discount?: number;
  };
}

export function OfflineApprovalPanel() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const authorized = user?.role === 'admin' || user?.role === 'manager';
  const cache = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['offline-approvals'],
    enabled: authorized,
    queryFn: async () =>
      (await apiClient.get<{ data: QuarantinedSale[] }>('/pos/sync/quarantine')).data.data,
    refetchInterval: 30000,
  });
  if (!authorized) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected === null || !user) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/pos/sync/quarantine/${selected}/resolve`, {
        decision,
        manager_id: user.id,
        manager_pin: pin,
        notes,
      });
      setSelected(null);
      setPin('');
      setNotes('');
      await cache.invalidateQueries({ queryKey: ['offline-approvals'] });
      await cache.invalidateQueries({ queryKey: ['dashboard-stats'] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('offlineApproval.failed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('offlineApproval.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-secondary mb-4">{t('offlineApproval.help')}</p>
        {query.isPending && <p role="status">{t('offlineApproval.loading')}</p>}
        {query.isError && (
          <div role="alert">
            <p>{t('offlineApproval.failed')}</p>
            <button onClick={() => void query.refetch()}>{t('offlineApproval.retry')}</button>
          </div>
        )}
        {query.isSuccess && query.data.length === 0 && (
          <p className="text-sm text-secondary">{t('offlineApproval.empty')}</p>
        )}
        <ul className="divide-y divide-border">
          {query.data?.map((sale) => (
            <li key={sale.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <strong>#{sale.id}</strong>
                  <span className="ms-3 text-sm">
                    {t('offlineApproval.cashier')} #{sale.cashier_id}
                  </span>
                  <p className="text-sm text-secondary">{sale.detail || sale.reason}</p>
                  <p className="text-xs text-secondary">
                    {new Date(sale.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  className="px-4 py-2 rounded border border-border hover:bg-card-hover"
                  disabled={saving}
                  onClick={() => {
                    setSelected(sale.id);
                    setPin('');
                    setNotes('');
                    setError('');
                    setDecision('approve');
                  }}
                >
                  {t('offlineApproval.review')}
                </button>
              </div>
              {selected === sale.id && (
                <form onSubmit={submit} className="mt-4 border-s-2 border-warning ps-4 space-y-3">
                  <ul className="text-sm font-mono">
                    {sale.payload.items.map((item, index) => (
                      <li key={index}>
                        #{item.product_id} · {item.quantity} × {item.unit_price.toFixed(2)} −{' '}
                        {item.discount.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    {t('offlineApproval.discount')}: {sale.payload.global_discount ?? 0}
                  </p>
                  <label className="block">
                    {t('offlineApproval.decision')}
                    <select
                      className="block bg-input-bg border border-border p-2 rounded"
                      value={decision}
                      onChange={(e) => setDecision(e.target.value as 'approve' | 'reject')}
                      disabled={saving}
                    >
                      <option value="approve">{t('offlineApproval.approve')}</option>
                      <option value="reject">{t('offlineApproval.reject')}</option>
                    </select>
                  </label>
                  <label className="block">
                    {t('offlineApproval.notes')}
                    <input
                      className="block bg-input-bg border border-border p-2 rounded w-full"
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving}
                    />
                  </label>
                  <label className="block">
                    {t('offlineApproval.pin')}
                    <input
                      className="block bg-input-bg border border-border p-2 rounded"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4,6}"
                      maxLength={6}
                      required
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      disabled={saving}
                      autoComplete="off"
                    />
                  </label>
                  {error && (
                    <p role="alert" className="text-danger">
                      {error}
                    </p>
                  )}
                  <button
                    className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? t('offlineApproval.saving') : t('offlineApproval.confirm')}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
