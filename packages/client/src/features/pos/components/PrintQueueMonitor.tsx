import { useState, useEffect } from 'react';
import type { PrintJob, PrinterStatus } from '@/types';
import toast from 'react-hot-toast';
import { Printer, CheckCircle2, RefreshCw } from 'lucide-react';

export function PrintQueueMonitor() {
  const [isElectron, setIsElectron] = useState(false);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [status, setStatus] = useState<PrinterStatus | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);

      // Poll queue & status every 3 seconds
      const interval = setInterval(() => {
        fetchQueueAndStatus();
      }, 3000);

      fetchQueueAndStatus();

      return () => clearInterval(interval);
    }
  }, []);

  const fetchQueueAndStatus = async () => {
    if (!window.electronAPI) return;
    try {
      const activeJobs = await window.electronAPI.getPrintJobs();
      const currentStatus = await window.electronAPI.getPrinterStatus();
      setJobs(activeJobs);
      setStatus(currentStatus);
    } catch (err) {
      console.error('[PrintQueueMonitor] Error polling queue state:', err);
    }
  };

  const handleRetry = async (jobId: string) => {
    if (!window.electronAPI) return;
    try {
      const success = await window.electronAPI.retryPrintJob(jobId);
      if (success) {
        toast.success('Retrying print job...');
        fetchQueueAndStatus();
      } else {
        toast.error('Failed to retry print job');
      }
    } catch (err: any) {
      toast.error(err.message || 'Retry override failed');
    }
  };

  const handleClearQueue = async () => {
    if (!window.electronAPI) return;
    if (confirm('Are you sure you want to clear the entire print job history?')) {
      try {
        await window.electronAPI.clearPrintQueue();
        toast.success('Print history cleared');
        fetchQueueAndStatus();
      } catch (err: any) {
        toast.error(err.message || 'Failed to clear print queue');
      }
    }
  };

  if (!isElectron) return null;

  // Filter queue jobs to active tasks (pending, processing, failed, retrying)
  const activeJobs = jobs.filter((j) => j.status !== 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');
  const processingJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending' || j.status === 'retrying');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-3 font-sans select-none text-xs text-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
          <Printer size={13} className="text-slate-500" />
          <span>Receipt Printer Queue</span>
        </span>
        {jobs.length > 0 && (
          <button
            type="button"
            onClick={handleClearQueue}
            className="text-[9px] font-semibold text-slate-500 hover:text-slate-300 hover:underline transition-colors"
            title="Clear Queue History"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Diagnostics / Printer status */}
      {status && (
        <div className="flex items-center justify-between bg-slate-950/40 p-2 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-400 truncate max-w-[170px]" title={status.message}>
            {status.message}
          </span>
          <span className="flex items-center space-x-1 shrink-0">
            <span className={`h-1.5 w-1.5 rounded-full ${status.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider ${status.online ? 'text-emerald-400' : 'text-rose-500'}`}>
              {status.online ? 'Online' : 'Offline'}
            </span>
          </span>
        </div>
      )}

      {/* Active Jobs notifications */}
      {activeJobs.length === 0 ? (
        <div className="flex items-center space-x-2 text-[10px] text-slate-500 italic py-1 pl-1">
          <CheckCircle2 size={13} className="text-slate-600" />
          <span>Print spooler is completely empty.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Spooling Notification */}
          {processingJobs.length > 0 && (
            <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 p-2 rounded text-[10px]">
              <span className="flex items-center">
                <RefreshCw size={11} className="mr-1.5 animate-spin" />
                Spooling {processingJobs.length} active print job(s)...
              </span>
              <span className="font-mono text-[9px]">ERP QUEUE</span>
            </div>
          )}

          {/* Failed Jobs List */}
          {failedJobs.map((job) => (
            <div
              key={job.id}
              className="bg-rose-950/25 border border-rose-900/30 rounded p-2.5 space-y-2 text-rose-300"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[10px] text-rose-400">
                    Print Failed: {job.receipt.receiptNumber}
                  </span>
                  <span className="text-[9px] font-mono text-rose-500 block leading-tight truncate max-w-[180px]" title={job.error || ''}>
                    Err: {job.error || 'Hardware connection lost'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetry(job.id)}
                  className="rounded bg-rose-900/40 text-rose-300 hover:bg-rose-900/60 border border-rose-900/40 px-2 py-1 text-[9px] font-bold uppercase transition-colors shrink-0"
                >
                  Retry Print
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default PrintQueueMonitor;
