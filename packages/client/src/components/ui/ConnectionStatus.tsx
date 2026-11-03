import { SyncService } from '@/features/pos/services/SyncService';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { useLANStore } from '@/features/pos/stores/useLANStore';
import { useTranslation } from '@/hooks/useTranslation';

export function ConnectionStatus() {
  const { status, offlineSales, offlineShiftClosures, syncIssues, syncing } = useLANStore();
  const { language } = useTranslation();
  const ar = language === 'ar';
  const count = offlineSales.length + offlineShiftClosures.length;
  const review = Object.values(syncIssues).filter((issue) => issue === 'review').length;
  const rejected = Object.values(syncIssues).filter((issue) => issue === 'rejected').length;
  return (
    <div className="retail-connection" role="status">
      {status === 'online' ? <Wifi size={16} /> : <WifiOff size={16} />}
      <span>{status === 'online' ? (ar ? 'متصل' : 'Connected') : ar ? 'غير متصل' : 'Offline'}</span>
      {count > 0 && (
        <span className="retail-pending">
          <Clock size={14} />
          {count} {ar ? 'بانتظار التسوية' : 'awaiting reconciliation'}
        </span>
      )}
      {count > 0 && (
        <button
          className="underline"
          disabled={syncing || status !== 'online'}
          onClick={() => void SyncService.tryFlush().catch(() => undefined)}
        >
          {syncing
            ? ar
              ? 'جارٍ المزامنة…'
              : 'Synchronizing…'
            : ar
              ? 'إعادة المحاولة'
              : 'Retry sync'}
        </button>
      )}
      {review > 0 && (
        <span>
          {review} {ar ? 'تحتاج موافقة المدير' : 'need manager approval'}
        </span>
      )}
      {rejected > 0 && (
        <span>
          {rejected} {ar ? 'مرفوضة — تحتاج تسوية' : 'rejected — require reconciliation'}
        </span>
      )}
    </div>
  );
}
