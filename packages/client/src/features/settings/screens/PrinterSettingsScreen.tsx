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
      <div className="flex flex-col items-center justify-center p-8 border border-input-border rounded-lg bg-input-bg/40 text-center max-w-md mx-auto my-12 text-input-text">
        <Printer className="h-10 w-10 text-secondary mb-3" />
        <h3 className="text-base font-semibold">{t('settings.desktopRequired')}</h3>
        <p className="text-sm text-secondary mt-2 leading-relaxed">
          {t('settings.desktopRequiredDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl font-sans text-foreground space-y-8 select-text">
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">{t('settings.printerSetup')}</h3>
            <p className="text-sm text-secondary font-medium mt-1">{t('settings.printerSetupDesc')}</p>
          </div>
        </div>
        <button
          onClick={checkPrinterStatus}
          disabled={isLoadingStatus}
          className="rounded-xl p-2.5 text-secondary hover:bg-card-hover hover:text-foreground hover:shadow-sm transition-all border border-border/60 bg-card focus:ring-2 focus:ring-primary/30 outline-none"
          title={t('settings.refreshPrinter')}
        >
          <RefreshCw size={18} className={isLoadingStatus ? 'animate-spin text-primary' : ''} />
        </button>
      </div>

      {/* Live status badge */}
      {printerStatus && (
        <div
          className={`flex items-start gap-4 rounded-2xl border p-5 shadow-sm transition-all ${
            printerStatus.online 
              ? 'border-success/30 bg-gradient-to-br from-success/5 to-success/10 text-success' 
              : 'border-danger/30 bg-gradient-to-br from-danger/5 to-danger/10 text-danger'
          }`}
        >
          <div className={`p-2.5 rounded-xl ${printerStatus.online ? 'bg-success/20' : 'bg-danger/20'}`}>
            {printerStatus.online ? <CheckCircle2 size={24} /> : <ShieldAlert size={24} />}
          </div>
          <div className="space-y-1 mt-0.5">
            <span className="text-sm font-bold uppercase tracking-widest block">
              {t('settings.printerStatus')}:{' '}
              <span className={printerStatus.online ? 'text-success drop-shadow-sm' : 'text-danger drop-shadow-sm'}>
                {printerStatus.online ? t('settings.online') : t('settings.offline')}
              </span>
            </span>
            <span className="text-xs font-semibold opacity-90 leading-relaxed block font-mono tracking-tight">
              {printerStatus.message}
            </span>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Printer Mode Selection */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-foreground tracking-wide">{t('settings.printerModel')}</label>
            <select
              value={config.type}
              onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
              className="w-full bg-card border border-border/60 rounded-xl px-4 py-3 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground shadow-sm hover:border-primary/50 cursor-pointer"
            >
              <option value="mock">{t('settings.mockPrinter')}</option>
              <option value="usb">{t('settings.usbPrinter')}</option>
            </select>
            <p className="text-xs text-secondary font-medium leading-relaxed max-w-[280px]">
              {t('settings.mockPrinterDesc')}
            </p>
          </div>

          {/* Paper Width Selection */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-foreground tracking-wide">{t('settings.paperWidth')}</label>
            <select
              value={config.paperWidth}
              onChange={(e) => setConfig({ ...config, paperWidth: Number(e.target.value) as any })}
              className="w-full bg-card border border-border/60 rounded-xl px-4 py-3 text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground shadow-sm hover:border-primary/50 cursor-pointer"
            >
              <option value={80}>{t('settings.width80')}</option>
              <option value={58}>{t('settings.width58')}</option>
            </select>
            <p className="text-xs text-secondary font-medium leading-relaxed max-w-[280px]">
              {t('settings.paperWidthDesc')}
            </p>
          </div>
        </div>

        {/* USB Path Selection (Only shown if USB mode selected) */}
        {config.type === 'usb' && (
          <div className="space-y-4 bg-card/60 p-6 border border-border/60 rounded-2xl shadow-sm">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-foreground flex items-center gap-2">
                <HardDrive size={18} className="text-primary" />
                <span>{t('settings.portPath')}</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={config.devicePath}
                  onChange={(e) => setConfig({ ...config, devicePath: e.target.value })}
                  placeholder={t('settings.placeholderPath')}
                  className="flex-1 bg-card border border-border/60 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-foreground shadow-sm"
                />

                {discoveredPorts.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setConfig({ ...config, devicePath: e.target.value });
                    }}
                    className="bg-primary/5 border border-primary/20 text-primary font-semibold rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none cursor-pointer transition-all hover:bg-primary/10"
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
              <p className="text-xs text-secondary flex items-center gap-1.5 font-medium bg-secondary/5 p-2.5 rounded-lg border border-secondary/10 w-fit">
                <HelpCircle size={14} className="text-secondary/70" />
                <span>{t('settings.noPrintersDetected')}</span>
              </p>
            ) : (
              <p className="text-xs text-success font-bold flex items-center gap-1.5 bg-success/10 p-2.5 rounded-lg border border-success/20 w-fit">
                <CheckCircle2 size={14} />
                <span>{t('settings.printersFound').replace('{count}', String(discoveredPorts.length))}</span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card/40 p-6 border border-border/60 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          {/* Auto Print Toggle */}
          <div className="flex items-start gap-4">
            <div className="flex items-center h-6 mt-1">
              <input
                id="autoPrint"
                type="checkbox"
                checked={config.autoPrint}
                onChange={(e) => setConfig({ ...config, autoPrint: e.target.checked })}
                className="h-5 w-5 rounded-md border-border/60 bg-card text-primary focus:ring-primary/30 focus:ring-offset-0 cursor-pointer transition-colors shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="autoPrint" className="text-sm font-bold text-foreground cursor-pointer tracking-wide">
                {t('settings.autoPrint')}
              </label>
              <p className="text-xs text-secondary font-medium leading-relaxed max-w-[240px]">
                {t('settings.autoPrintDesc')}
              </p>
            </div>
          </div>

          {/* Retry Threshold */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-foreground tracking-wide">{t('settings.retryPolicy')}</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="10"
                value={config.retries}
                onChange={(e) =>
                  setConfig({ ...config, retries: Math.max(0, Number(e.target.value)) })
                }
                className="w-24 bg-card border border-border/60 rounded-xl px-4 py-2.5 text-base font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-center text-foreground shadow-sm"
              />
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">{t('settings.attempts')}</span>
            </div>
            <p className="text-xs text-secondary font-medium leading-relaxed max-w-[240px]">
              {t('settings.retryPolicyDesc')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-border/40 flex items-center gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center rounded-xl bg-success px-8 py-3 text-sm font-bold tracking-wide text-white hover:bg-success/90 disabled:opacity-50 transition-all shadow-md shadow-success/20 hover:shadow-lg hover:shadow-success/30 hover:-translate-y-0.5"
          >
            {isSaving ? t('settings.savingConfig') : t('settings.saveConfig')}
          </button>

          <button
            type="button"
            onClick={handleTestPrint}
            disabled={isTesting}
            className="flex items-center justify-center rounded-xl bg-card hover:bg-card-hover border border-border/80 px-8 py-3 text-sm font-bold tracking-wide text-foreground disabled:opacity-50 transition-all shadow-sm hover:shadow-md hover:border-primary/40 hover:text-primary hover:-translate-y-0.5"
          >
            {isTesting ? t('settings.sendingTest') : t('settings.printTest')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PrinterSettingsScreen;
