import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { PrinterConfig, PrinterStatus } from '@/types';
import { Printer, ShieldAlert, CheckCircle2, RefreshCw, HelpCircle, HardDrive } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function PrinterSettingsScreen() {
  const { t } = useTranslation();
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
      toast.error(t('settings.desktopPrintingWarning'));
      return;
    }
    setIsTesting(true);
    try {
      const res = await window.electronAPI.testPrinter(config);
      if (res.online) {
        toast.success(t('settings.testSuccess'));
      } else {
        toast.error(`${t('settings.testFailed')}: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(err.message || t('settings.failedTriggerTest'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.electronAPI) {
      toast.error(t('settings.desktopPrintingWarning'));
      return;
    }
    setIsSaving(true);
    try {
      await window.electronAPI.updatePrinterConfig(config);
      toast.success(t('settings.configSaved'));

      // Re-scan ports & status
      checkPrinterStatus();
      const ports = await window.electronAPI.discoverPrinters();
      setDiscoveredPorts(ports);
    } catch (err: any) {
      toast.error(err.message || t('settings.failedSaveConfig'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-border rounded-lg bg-input/40 text-center max-w-md mx-auto my-12 text-foreground">
        <Printer className="h-10 w-10 text-secondary mb-3" />
        <h3 className="text-base font-semibold">{t('settings.desktopRequired')}</h3>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          {t('settings.desktopRequiredDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl font-sans text-foreground space-y-6 select-text">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-semibold">{t('settings.printerSetup')}</h3>
          <p className="text-sm text-secondary mt-1">{t('settings.printerSetupDesc')}</p>
        </div>
        <button
          onClick={checkPrinterStatus}
          disabled={isLoadingStatus}
          className="rounded-lg p-2 text-secondary hover:bg-card-hover hover:text-foreground transition-colors border border-border"
          title={t('settings.refreshPrinter')}
        >
          <RefreshCw size={16} className={isLoadingStatus ? 'animate-spin text-success' : ''} />
        </button>
      </div>

      {/* Live status badge */}
      {printerStatus && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${printerStatus.online ? 'border-success/30 bg-success/15 text-success' : 'border-danger/20 bg-danger/15 text-danger'}`}
        >
          <div className="mt-0.5">
            {printerStatus.online ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          </div>
          <div className="space-y-1">
            <span className="text-sm font-semibold uppercase tracking-wide block">
              {t('settings.printerStatus')}:{' '}
              {printerStatus.online ? t('settings.online') : t('settings.offline')}
            </span>
            <span className="text-xs opacity-85 leading-relaxed block font-mono">
              {printerStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Printer Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('settings.printerModel')}</label>
            <select
              value={config.type}
              onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-foreground"
            >
              <option value="mock">{t('settings.mockPrinter')}</option>
              <option value="usb">{t('settings.usbPrinter')}</option>
            </select>
            <p className="text-xs text-secondary font-sans leading-relaxed">
              {t('settings.mockPrinterDesc')}
            </p>
          </div>

          {/* Paper Width Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('settings.paperWidth')}</label>
            <select
              value={config.paperWidth}
              onChange={(e) => setConfig({ ...config, paperWidth: Number(e.target.value) as any })}
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-foreground"
            >
              <option value={80}>{t('settings.width80')}</option>
              <option value={58}>{t('settings.width58')}</option>
            </select>
            <p className="text-xs text-secondary font-sans leading-relaxed">
              {t('settings.paperWidthDesc')}
            </p>
          </div>
        </div>

        {/* USB Path Selection (Only shown if USB mode selected) */}
        {config.type === 'usb' && (
          <div className="space-y-3 bg-input/40 p-4 border border-border rounded-xl">
            <div className="space-y-2">
              <label className="block text-sm font-medium flex items-center gap-1.5">
                <HardDrive size={16} className="text-secondary" />
                <span>{t('settings.portPath')}</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={config.devicePath}
                  onChange={(e) => setConfig({ ...config, devicePath: e.target.value })}
                  placeholder={t('settings.placeholderPath')}
                  className="flex-1 bg-input border border-border rounded-lg px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-foreground"
                />

                {discoveredPorts.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setConfig({ ...config, devicePath: e.target.value });
                    }}
                    className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none"
                    value=""
                  >
                    <option value="" disabled>
                      {t('settings.autoPorts')}
                    </option>
                    {discoveredPorts.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {discoveredPorts.length === 0 ? (
              <p className="text-xs text-secondary flex items-center gap-1.5">
                <HelpCircle size={12} />
                <span>{t('settings.noPrintersDetected')}</span>
              </p>
            ) : (
              <p className="text-xs text-success font-medium">
                {t('settings.printersFound').replace('{count}', String(discoveredPorts.length))}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-input/20 p-4 border border-border rounded-xl">
          {/* Auto Print Toggle */}
          <div className="flex items-start gap-3 pt-1">
            <input
              id="autoPrint"
              type="checkbox"
              checked={config.autoPrint}
              onChange={(e) => setConfig({ ...config, autoPrint: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-primary focus:ring-offset-0 mt-0.5"
            />
            <div className="space-y-1">
              <label htmlFor="autoPrint" className="text-sm font-semibold cursor-pointer">
                {t('settings.autoPrint')}
              </label>
              <p className="text-xs text-secondary leading-relaxed">
                {t('settings.autoPrintDesc')}
              </p>
            </div>
          </div>

          {/* Retry Threshold */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">{t('settings.retryPolicy')}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="10"
                value={config.retries}
                onChange={(e) =>
                  setConfig({ ...config, retries: Math.max(0, Number(e.target.value)) })
                }
                className="w-24 bg-input border border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-center text-foreground"
              />
              <span className="text-xs text-secondary">{t('settings.attempts')}</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              {t('settings.retryPolicyDesc')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-5 border-t border-border flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50 transition-colors shadow-lg shadow-success/10"
          >
            {isSaving ? t('settings.savingConfig') : t('settings.saveConfig')}
          </button>

          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="flex items-center justify-center rounded-lg bg-card hover:bg-card-hover border border-border px-6 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50 transition-colors"
          >
            {isTesting ? t('settings.sendingTest') : t('settings.printTest')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PrinterSettingsScreen;
