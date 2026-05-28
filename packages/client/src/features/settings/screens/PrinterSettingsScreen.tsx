import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { PrinterConfig, PrinterStatus } from '@/types';
import { Printer, ShieldAlert, CheckCircle2, RefreshCw, HelpCircle, HardDrive } from 'lucide-react';

export function PrinterSettingsScreen() {
  const [isElectron, setIsElectron] = useState(false);
  const [discoveredPorts, setDiscoveredPorts] = useState<string[]>([]);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [config, setConfig] = useState<PrinterConfig>({
    type: 'mock',
    paperWidth: 80,
    devicePath: '/dev/usb/lp0',
    autoPrint: true,
    retries: 3,
  });

  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);

      // Load active config
      window.electronAPI.getPrinterConfig().then((cfg) => {
        if (cfg) setConfig(cfg);
      });

      // Scan available USB port endpoints
      window.electronAPI.discoverPrinters().then((ports) => {
        setDiscoveredPorts(ports);
      });

      // Retrieve device online status
      checkPrinterStatus();
    }
  }, []);

  const checkPrinterStatus = async () => {
    if (!window.electronAPI) return;
    setIsLoadingStatus(true);
    try {
      const status = await window.electronAPI.getPrinterStatus();
      setPrinterStatus(status);
    } catch (err) {
      console.error('Error fetching printer status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleTestPrint = async () => {
    if (!window.electronAPI) {
      toast.error('Native printing is only available inside the Desktop Shell');
      return;
    }
    setIsTesting(true);
    try {
      const res = await window.electronAPI.testPrinter(config);
      if (res.online) {
        toast.success('Test receipt enqueued successfully');
      } else {
        toast.error(`Test Print Failed: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger hardware printer test');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electronAPI) {
      toast.error('Native printing is only available inside the Desktop Shell');
      return;
    }
    setIsSaving(true);
    try {
      await window.electronAPI.updatePrinterConfig(config);
      toast.success('Printer configuration saved successfully');
      
      // Re-scan ports & status
      checkPrinterStatus();
      const ports = await window.electronAPI.discoverPrinters();
      setDiscoveredPorts(ports);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save printer configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-neutral-800 rounded-lg bg-neutral-950/40 text-center max-w-md mx-auto my-12">
        <Printer className="h-10 w-10 text-neutral-500 mb-3" />
        <h3 className="text-base font-semibold text-neutral-300">Desktop Integration Required</h3>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          Native hardware ESC/POS direct USB printing is locked to the desktop app shell. Standard web browsers cannot access physical USB ports directly.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl font-sans text-neutral-100 space-y-6 select-text">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h3 className="text-xl font-semibold text-neutral-100">ESC/POS Printer Setup</h3>
          <p className="text-sm text-neutral-400 mt-1">Configure direct USB ESC/POS thermal receipt printing.</p>
        </div>
        <button
          onClick={checkPrinterStatus}
          disabled={isLoadingStatus}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors border border-neutral-800"
          title="Refresh Printer Connection State"
        >
          <RefreshCw size={16} className={isLoadingStatus ? 'animate-spin text-emerald-400' : ''} />
        </button>
      </div>

      {/* Live status badge */}
      {printerStatus && (
        <div className={`flex items-start space-x-3 rounded-lg border p-4 ${printerStatus.online ? 'border-emerald-900/30 bg-emerald-950/15 text-emerald-300' : 'border-rose-900/30 bg-rose-950/15 text-rose-300'}`}>
          <div className="mt-0.5">
            {printerStatus.online ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          </div>
          <div className="space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wide block">
              Printer Status: {printerStatus.online ? 'Online' : 'Offline'}
            </span>
            <span className="text-xs opacity-85 leading-relaxed block font-mono">{printerStatus.message}</span>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Printer Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300">Printer Model Type</label>
            <select
              value={config.type}
              onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value="mock">Development Mock Printer (Visual Logs)</option>
              <option value="usb">Native USB Printer (ESC/POS Raw Direct)</option>
            </select>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              Use Mock mode to simulate printing without a physical receipt printer plugged in.
            </p>
          </div>

          {/* Paper Width Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300">Receipt Paper Width</label>
            <select
              value={config.paperWidth}
              onChange={(e) => setConfig({ ...config, paperWidth: Number(e.target.value) as any })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            >
              <option value={80}>80mm (High Capacity / Standard Supermarket)</option>
              <option value={58}>58mm (Compact Portable / Small Roll)</option>
            </select>
            <p className="text-xs text-neutral-500 font-sans leading-relaxed">
              Adjusts line character sizes (80mm formats to 48 columns; 58mm formats to 32 columns).
            </p>
          </div>
        </div>

        {/* USB Path Selection (Only shown if USB mode selected) */}
        {config.type === 'usb' && (
          <div className="space-y-3 bg-neutral-950/40 p-4 border border-neutral-800 rounded-xl">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300 flex items-center space-x-1.5">
                <HardDrive size={16} className="text-neutral-500" />
                <span>Printer Port Device Path</span>
              </label>

              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={config.devicePath}
                  onChange={(e) => setConfig({ ...config, devicePath: e.target.value })}
                  placeholder="e.g. /dev/usb/lp0"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono"
                />
                
                {discoveredPorts.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setConfig({ ...config, devicePath: e.target.value });
                    }}
                    className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 focus:outline-none"
                    value=""
                  >
                    <option value="" disabled>Auto-Discovered Ports</option>
                    {discoveredPorts.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {discoveredPorts.length === 0 ? (
              <p className="text-xs text-neutral-500 flex items-center space-x-1.5">
                <HelpCircle size={12} />
                <span>No active USB printers detected. Connect your device or verify OS permissions.</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-500 font-medium">
                Found {discoveredPorts.length} active printer port(s) connected to this terminal.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-950/20 p-4 border border-neutral-800 rounded-xl">
          {/* Auto Print Toggle */}
          <div className="flex items-start space-x-3 pt-1">
            <input
              id="autoPrint"
              type="checkbox"
              checked={config.autoPrint}
              onChange={(e) => setConfig({ ...config, autoPrint: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 mt-0.5"
            />
            <div className="space-y-1">
              <label htmlFor="autoPrint" className="text-sm font-semibold text-neutral-200 cursor-pointer">
                Automatic Printing
              </label>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Immediately enqueue and print receipts when checkouts finish without popup confirmations.
              </p>
            </div>
          </div>

          {/* Retry Threshold */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300">Failure Retry Policy</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="10"
                value={config.retries}
                onChange={(e) => setConfig({ ...config, retries: Math.max(0, Number(e.target.value)) })}
                className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-center"
              />
              <span className="text-xs text-neutral-400">Retry Attempts</span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Number of background retries if the printer encounters a connection drop or paper cut block.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-5 border-t border-neutral-800 flex items-center space-x-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-950/20"
          >
            {isSaving ? 'Saving Configuration...' : 'Save Configuration'}
          </button>
          
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="flex items-center justify-center rounded-lg bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 px-6 py-2.5 text-sm font-semibold text-neutral-200 hover:text-neutral-100 disabled:opacity-50 transition-colors"
          >
            {isTesting ? 'Sending test print...' : 'Print Test Receipt'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PrinterSettingsScreen;
