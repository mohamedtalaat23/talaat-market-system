import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { ManagerApproveCommitModal } from './ManagerApproveCommitModal';

export function ReturnApprovalDashboard() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  const { data: queues = [], refetch } = useQuery({
    queryKey: ['return-queues', 'SUBMITTED'],
    queryFn: async () => {
      const res = await apiClient.get('/return-queues?state=SUBMITTED');
      return res.data?.data || [];
    },
    refetchInterval: 15000,
  });

  const getAgeColor = (ageState: string) => {
    switch (ageState) {
      case 'CRITICAL':
        return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'WARNING':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600';
      default:
        return 'bg-green-500/10 border-green-500/20 text-green-600';
    }
  };

  if (queues.length === 0) return null;

  return (
    <>
      <Card className="border border-border mt-4">
        <CardHeader className="pb-3 border-b border-border bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base font-bold text-foreground">
              {t('dashboard.returns.title').replace('{count}', String(queues.length))}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {queues.map((q: any) => {
              const isMine = q.created_by === user?.id;
              return (
                <button
                  key={q.queue_id}
                  onClick={() => !isMine && setSelectedQueueId(q.queue_id)}
                  disabled={isMine}
                  className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                    isMine
                      ? 'bg-neutral-100 opacity-60 cursor-not-allowed'
                      : 'hover:bg-indigo-50/50 cursor-pointer group'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${getAgeColor(q.age_state)}`}
                    >
                      <Clock className="w-3 h-3" />
                      {q.age_state}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-indigo-600 transition-colors">
                        {t('dashboard.returns.queueTitle').replace('{type}', q.queue_type)}
                      </div>
                      <div className="text-xs text-secondary mt-0.5 flex gap-3">
                        <span>
                          {t('dashboard.returns.createdBy').replace(
                            '{owner}',
                            q.owner_id === user?.id ? t('dashboard.returns.me') : t('dashboard.returns.cashier'),
                          )}
                        </span>
                        <span className="text-neutral-300">|</span>
                        <span>
                          {t('dashboard.returns.value').replace(
                            '{amount}',
                            q.items
                              ?.reduce((acc: number, i: any) => acc + i.unit_price * i.quantity, 0)
                              .toFixed(2) || '0.00',
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isMine && (
                    <div className="text-xs font-semibold text-secondary flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {t('dashboard.returns.awaitingOtherManager')}
                    </div>
                  )}
                  {!isMine && (
                    <div className="text-sm font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                      {t('dashboard.returns.review')} &rarr;
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedQueueId && (
        <ManagerApproveCommitModal
          queueId={selectedQueueId}
          onClose={() => {
            setSelectedQueueId(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
