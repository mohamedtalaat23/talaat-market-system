import { useState, useEffect } from 'react';
import type { PrintJob, PrinterStatus } from '@/types';
import toast from 'react-hot-toast';
import { Printer, CheckCircle2, RefreshCw, Settings, Save, Zap } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function PrintQueueMonitor() {
  const { t } = useTranslation();
  const [isElectron, setIsElectron] = useState(false);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [status, setStatus] = useState<PrinterStatus | null>(null);

  // Dashboard & Re-routing States
  const [showSettings, setShowSettings] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<any>({
    type: 'mock',
    devicePath: '/dev/usb/lp0',
    paperWidth: 80,
  });
  const [discoveredPorts, setDiscoveredPorts] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);

      // Poll queue & status every 3 seconds
      const interval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchQueueAndStatus();
        }
      }, 3000);

      fetchQueueAndStatus();
      loadPrinterSettings();

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

  const loadPrinterSettings = async () => {
    if (!window.electronAPI) return;
    try {
      const cfg = await window.electronAPI.getPrinterConfig();
      const ports = await window.electronAPI.discoverPrinters();
      setPrinterConfig(cfg);
      setDiscoveredPorts(ports);
    } catch (err) {
      console.error('[PrintQueueMonitor] Failed to load printer settings:', err);
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

  const handleTestPrinter = async () => {
    if (!window.electronAPI) return;
    setIsTesting(true);
    const toastId = toast.loading('Sending test print command...');
    try {
      const res = (await window.electronAPI.testPrinter(printerConfig)) as unknown as {
        success: boolean;
        message: string;
      };
      setIsTesting(false);
      if (res.success) {
        toast.success('Test print sent successfully!', { id: toastId });
      } else {
        toast.error(`Test print failed: ${res.message}`, { id: toastId, duration: 5000 });
      }
    } catch (err: any) {
      setIsTesting(false);
      toast.error(err.message || 'Test print timed out', { id: toastId });
    }
  };

  const handleSaveConfig = async () => {
    if (!window.electronAPI) return;
    setIsSaving(true);
    try {
      const success = await window.electronAPI.updatePrinterConfig(printerConfig);
      setIsSaving(false);
      if (success) {
        toast.success('Printer configuration saved & active', { icon: '💾' });
        setShowSettings(false);
        fetchQueueAndStatus();
      } else {
        toast.error('Failed to save printer configuration');
      }
    } catch (err: any) {
      setIsSaving(false);
      toast.error(err.message || 'Failed to save config');
    }
  };

  if (!isElectron) return null;

  // Filter queue jobs to active tasks (pending, processing, failed, retrying)
  const activeJobs = jobs.filter((j) => j.status !== 'completed');
  const failedJobs = jobs.filter((j) => j.status === 'failed');
  const processingJobs = jobs.filter(
    (j) => j.status === 'processing' || j.status === 'pending' || j.status === 'retrying',
  );

  return (
    <div className="bg-card/40 border border-border/60 rounded-2xl p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-4 font-sans select-none text-xs text-secondary transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-sm">
            <Printer size={14} />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">
            {t('pos.receiptPrinterQueue')}
          </span>
        </div>
        <div className="flex items-center space-x-2.5">
          {jobs.length > 0 && (
            <button
              type="button"
              onClick={handleClearQueue}
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-secondary/10 text-secondary hover:bg-secondary/20 hover:text-foreground transition-all"
              title="Clear Queue History"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowSettings(!showSettings);
              if (!showSettings) loadPrinterSettings();
            }}
            className={`p-1.5 rounded-lg border transition-all ${showSettings ? 'bg-success/10 text-success border-success/30 shadow-sm' : 'bg-card text-secondary hover:text-foreground border-border/60 hover:border-primary/40 hover:bg-card-hover'}`}
            title="Printer Settings & Port Re-routing"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Collapsible Printer Settings & Re-routing Board */}
      {showSettings && (
        <div className="bg-card/60 p-4 rounded-xl border border-border/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)] space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="text-[10px] font-black uppercase tracking-widest text-secondary/70">
            Device Routing & Configuration
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                Printer Type
              </label>
              <select
                className="w-full bg-card border border-border/80 rounded-lg px-2.5 py-2 text-foreground font-medium text-xs focus:outline-none focus:border-success focus:ring-1 focus:ring-success/20 transition-all shadow-sm cursor-pointer"
                value={printerConfig.type}
                onChange={(e) => setPrinterConfig({ ...printerConfig, type: e.target.value })}
              >
                <option value="mock">Virtual Mock Log</option>
                <option value="usb">Native USB Terminal</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                Paper Width
              </label>
              <select
                className="w-full bg-card border border-border/80 rounded-lg px-2.5 py-2 text-foreground font-medium text-xs focus:outline-none focus:border-success focus:ring-1 focus:ring-success/20 transition-all shadow-sm cursor-pointer"
                value={printerConfig.paperWidth}
                onChange={(e) =>
                  setPrinterConfig({ ...printerConfig, paperWidth: Number(e.target.value) })
                }
              >
                <option value={80}>80 mm (Standard)</option>
                <option value={58}>58 mm (Narrow)</option>
              </select>
            </div>
          </div>

          {printerConfig.type === 'usb' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-foreground">
                Device Path / Port
              </label>
              <input
                type="text"
                className="w-full bg-card border border-border/80 rounded-lg px-3 py-2.5 text-foreground font-mono text-xs focus:outline-none focus:border-success focus:ring-1 focus:ring-success/20 transition-all shadow-sm placeholder:text-secondary/50"
                value={printerConfig.devicePath}
                onChange={(e) => setPrinterConfig({ ...printerConfig, devicePath: e.target.value })}
                placeholder="/dev/usb/lp0"
                list="discovered-ports"
              />
              <datalist id="discovered-ports">
                {discoveredPorts.map((port) => (
                  <option key={port} value={port} />
                ))}
              </datalist>
              {discoveredPorts.length > 0 ? (
                <div className="text-[10px] font-bold text-success flex items-center gap-1.5 mt-1.5 bg-success/10 p-2 rounded-md border border-success/20">
                  <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                  Discovered Ports: {discoveredPorts.join(', ')}
                </div>
              ) : (
                <div className="text-[10px] font-medium text-secondary/80 flex items-center gap-1.5 mt-1.5 bg-secondary/10 p-2 rounded-md border border-secondary/20">
                  <span className="w-1.5 h-1.5 bg-secondary/50 rounded-full"></span>
                  No USB printers discovered. Enter path manually.
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2.5 pt-1">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestPrinter}
              className="flex-1 py-2 bg-card hover:bg-card-hover border border-border/60 hover:border-warning/40 disabled:opacity-50 text-foreground rounded-lg font-bold transition-all shadow-sm flex items-center justify-center space-x-1.5 hover:-translate-y-0.5 hover:shadow-md group"
            >
              <Zap size={12} className="text-warning group-hover:animate-pulse" />
              <span>Test Print</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveConfig}
              className="flex-[1.5] py-2 bg-success hover:bg-success/90 disabled:opacity-50 text-white rounded-lg font-bold tracking-wide transition-all shadow-sm shadow-success/20 flex items-center justify-center space-x-1.5 hover:-translate-y-0.5 hover:shadow-md hover:shadow-success/30"
            >
              <Save size={12} />
              <span>Save & Route</span>
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics / Printer status */}
      {status && (
        <div className="flex items-center justify-between bg-card p-2.5 rounded-xl border border-border/60 shadow-sm">
          <span
            className="text-xs font-medium text-secondary truncate max-w-[160px]"
            title={status.message}
          >
            {status.message}
          </span>
          <div className={`flex items-center space-x-1.5 shrink-0 px-2.5 py-1 rounded-md border bg-card ${status.online ? 'border-success/30' : 'border-danger/30'}`}>
            <span
              className={`h-2 w-2 rounded-full shadow-sm ${status.online ? 'bg-success animate-pulse shadow-success/40' : 'bg-danger shadow-danger/40'}`}
            />
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${status.online ? 'text-success' : 'text-danger'}`}
            >
              {status.online ? t('settings.online') : t('settings.offline')}
            </span>
          </div>
        </div>
      )}

      {/* Active Jobs notifications */}
      <div className="min-h-[40px] flex flex-col justify-center">
        {activeJobs.length === 0 ? (
          <div className="flex items-center space-x-2.5 text-xs text-secondary/60 font-medium py-1 px-1.5">
            <CheckCircle2 size={14} className="text-secondary/40" />
            <span>Print spooler is completely empty.</span>
          </div>
        ) : (
          <div className="space-y-2.5 w-full">
            {/* Spooling Notification */}
            {processingJobs.length > 0 && (
              <div className="flex items-center justify-between bg-gradient-to-r from-success/10 to-success/5 border border-success/30 shadow-sm text-success p-3 rounded-xl text-xs animate-in slide-in-from-bottom-2 fade-in">
                <span className="flex items-center font-bold">
                  <RefreshCw size={14} className="mr-2 animate-spin text-success" />
                  Spooling {processingJobs.length} print job{processingJobs.length > 1 ? 's' : ''}...
                </span>
                <span className="font-mono text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded bg-success/20">ERP</span>
              </div>
            )}

            {/* Failed Jobs List */}
            {failedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-gradient-to-r from-danger/10 to-danger/5 border border-danger/30 shadow-sm rounded-xl p-3 space-y-2 text-danger animate-in slide-in-from-bottom-2 fade-in"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="font-black block text-xs tracking-wide">
                      Print Failed: <span className="font-mono ml-0.5">{job.receipt.receiptNumber}</span>
                    </span>
                    <span
                      className="text-[11px] font-medium opacity-90 block leading-tight truncate max-w-[170px]"
                      title={job.error || ''}
                    >
                      <span className="font-bold">Err:</span> {job.error || 'Connection lost'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRetry(job.id)}
                    className="rounded-lg bg-danger hover:bg-danger/90 text-white shadow-sm shadow-danger/20 border border-danger/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all shrink-0 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PrintQueueMonitor;
