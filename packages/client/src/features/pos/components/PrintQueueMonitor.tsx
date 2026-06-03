import { useState, useEffect } from 'react';
import type { PrintJob, PrinterStatus } from '@/types';
import toast from 'react-hot-toast';
import { Printer, CheckCircle2, RefreshCw, Settings, Save, Zap } from 'lucide-react';

export function PrintQueueMonitor() {
  const [isElectron, setIsElectron] = useState(false);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  
  // Dashboard & Re-routing States
  const [showSettings, setShowSettings] = useState(false);
  const [printerConfig, setPrinterConfig] = useState<any>({ type: 'mock', devicePath: '/dev/usb/lp0', paperWidth: 80 });
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
      const res = (await window.electronAPI.testPrinter(printerConfig)) as unknown as { success: boolean; message: string };
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
  const processingJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'pending' || j.status === 'retrying');

  return (
    <div className="bg-card border border-border rounded-lg p-3.5 space-y-3 font-sans select-none text-xs text-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary flex items-center space-x-1.5">
          <Printer size={13} className="text-secondary" />
          <span>Receipt Printer Queue</span>
        </span>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              setShowSettings(!showSettings);
              if (!showSettings) loadPrinterSettings();
            }}
            className={`p-1 rounded hover:bg-card-hover transition-colors ${showSettings ? 'text-success bg-card-hover/40' : 'text-secondary hover:text-foreground'}`}
            title="Printer Settings & Port Re-routing"
          >
            <Settings size={13} />
          </button>
          {jobs.length > 0 && (
            <button
              type="button"
              onClick={handleClearQueue}
              className="text-[9px] font-semibold text-secondary hover:text-foreground hover:underline transition-colors"
              title="Clear Queue History"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Printer Settings & Re-routing Board */}
      {showSettings && (
        <div className="bg-input/60 p-3 rounded-lg border border-border space-y-3 animate-fade-in text-[11px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1">
            Device Routing & Configuration
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-secondary font-semibold mb-1">Printer Type</label>
              <select
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-success"
                value={printerConfig.type}
                onChange={(e) => setPrinterConfig({ ...printerConfig, type: e.target.value })}
              >
                <option value="mock">Virtual Mock Log</option>
                <option value="usb">Native USB Terminal</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-secondary font-semibold mb-1">Paper Width</label>
              <select
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-success"
                value={printerConfig.paperWidth}
                onChange={(e) => setPrinterConfig({ ...printerConfig, paperWidth: Number(e.target.value) })}
              >
                <option value={80}>80 mm (Standard)</option>
                <option value={58}>58 mm (Narrow)</option>
              </select>
            </div>
          </div>

          {printerConfig.type === 'usb' && (
            <div>
              <label className="block text-[9px] text-secondary font-semibold mb-1">Device Path / Port</label>
              <input
                type="text"
                className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-foreground focus:outline-none focus:border-success mb-1.5"
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
                <div className="text-[9px] text-success italic">
                  Discovered Ports: {discoveredPorts.join(', ')}
                </div>
              ) : (
                <div className="text-[9px] text-muted italic">
                  No USB printers discovered dynamically. Enter path manually.
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestPrinter}
              className="flex-1 py-1.5 bg-card-hover hover:bg-border disabled:opacity-50 text-secondary hover:text-foreground rounded font-semibold transition-colors flex items-center justify-center space-x-1"
            >
              <Zap size={10} className="text-warning" />
              <span>Test Print</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveConfig}
              className="flex-1 py-1.5 bg-success hover:bg-success/90 disabled:opacity-50 text-white rounded font-semibold transition-colors flex items-center justify-center space-x-1"
            >
              <Save size={10} />
              <span>Save & Route</span>
            </button>
          </div>
        </div>
      )}

      {/* Diagnostics / Printer status */}
      {status && (
        <div className="flex items-center justify-between bg-input/40 p-2 rounded border border-border">
          <span className="text-[10px] text-secondary truncate max-w-[170px]" title={status.message}>
            {status.message}
          </span>
          <span className="flex items-center space-x-1 shrink-0">
            <span className={`h-1.5 w-1.5 rounded-full ${status.online ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-wider ${status.online ? 'text-success' : 'text-danger'}`}>
              {status.online ? 'Online' : 'Offline'}
            </span>
          </span>
        </div>
      )}

      {/* Active Jobs notifications */}
      {activeJobs.length === 0 ? (
        <div className="flex items-center space-x-2 text-[10px] text-muted italic py-1 pl-1">
          <CheckCircle2 size={13} className="text-muted" />
          <span>Print spooler is completely empty.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Spooling Notification */}
          {processingJobs.length > 0 && (
            <div className="flex items-center justify-between bg-success/10 border border-success/20 text-success p-2 rounded text-[10px]">
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
              className="bg-danger/10 border border-danger/20 rounded p-2.5 space-y-2 text-danger"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[10px] text-danger">
                    Print Failed: {job.receipt.receiptNumber}
                  </span>
                  <span className="text-[9px] font-mono text-danger/90 block leading-tight truncate max-w-[180px]" title={job.error || ''}>
                    Err: {job.error || 'Hardware connection lost'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetry(job.id)}
                  className="rounded bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30 px-2 py-1 text-[9px] font-bold uppercase transition-colors shrink-0"
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
