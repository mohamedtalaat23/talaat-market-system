import { useState } from 'react';
import { useLANStore, OfflineSale } from '@/features/pos/stores/useLANStore';
import toast from 'react-hot-toast';
import {
  Wifi,
  WifiOff,
  Monitor,
  Server,
  Laptop,
  Activity,
  Database,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function LANSettingsScreen() {
  const { t } = useTranslation();
  const {
    mode,
    hostAddress,
    status,
    offlineSales,
    setMode,
    setHostAddress,
    clearOfflineSales,
    removeOfflineSale,
  } = useLANStore();
  const [addressInput, setAddressInput] = useState(hostAddress);
  const [testingConnection, setTestingConnection] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);
  const [selectedSale, setSelectedSale] = useState<OfflineSale | null>(null);

  // Address validation helper
  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'client' && !isValidUrl(addressInput)) {
      toast.error(t('settings.validUrlError'));
      return;
    }
    setHostAddress(addressInput);
    toast.success(t('settings.lanConfigSaved'));
  };

  const handleTestConnection = async () => {
    if (!isValidUrl(addressInput)) {
      toast.error(t('settings.validHostWarning'));
      return;
    }

    setTestingConnection(true);
    setPingResult(null);
    const startTime = Date.now();

    try {
      const cleanAddress = addressInput.replace(/\/$/, '');
      const response = await fetch(`${cleanAddress}/api/v1/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Set a low timeout so ping does not hang
        signal: AbortSignal.timeout(4000),
      });

      const latency = Date.now() - startTime;
      if (response.ok) {
        setPingResult({ success: true, latency });
        toast.success(t('settings.connSuccess').replace('{latency}', String(latency)));
      } else {
        throw new Error(`Server returned status code ${response.status}`);
      }
    } catch (error: any) {
      setPingResult({
        success: false,
        error: error.message || 'Host unreachable or health endpoint not found',
      });
      toast.error(t('settings.connFailed'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearBuffer = () => {
    if (window.confirm(t('settings.clearBufferConfirm'))) {
      clearOfflineSales();
      toast.success(t('settings.bufferClearedSuccess'));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl text-foreground select-text">
      <div className="flex items-center gap-4 border-b border-border/40 pb-5">
        <div className="p-3 bg-success/10 rounded-2xl border border-success/20 text-success">
          <Wifi className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tight text-foreground">{t('settings.lanTitle')}</h3>
          <p className="text-sm text-secondary font-medium mt-1">{t('settings.lanDesc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Standalone Selector */}
        <div
          onClick={() => setMode('standalone')}
          className={`flex flex-col p-6 rounded-2xl border cursor-pointer transition-all shadow-sm group ${
            mode === 'standalone'
              ? 'bg-gradient-to-br from-success/5 to-success/10 border-success shadow-success/10 scale-[1.02]'
              : 'bg-card border-border/60 hover:border-success/40 hover:shadow-md'
          }`}
        >
          <div className={`p-3 rounded-xl w-fit mb-4 ${mode === 'standalone' ? 'bg-success/20 text-success' : 'bg-secondary/10 text-secondary group-hover:bg-success/10 group-hover:text-success'}`}>
            <Monitor size={24} />
          </div>
          <h4 className="font-bold text-foreground text-lg tracking-tight">{t('settings.standalone')}</h4>
          <p className="text-xs text-secondary font-medium mt-1.5 leading-relaxed">{t('settings.standaloneDesc')}</p>
        </div>

        {/* Master Selector */}
        <div
          onClick={() => setMode('master')}
          className={`flex flex-col p-6 rounded-2xl border cursor-pointer transition-all shadow-sm group ${
            mode === 'master'
              ? 'bg-gradient-to-br from-success/5 to-success/10 border-success shadow-success/10 scale-[1.02]'
              : 'bg-card border-border/60 hover:border-success/40 hover:shadow-md'
          }`}
        >
          <div className={`p-3 rounded-xl w-fit mb-4 ${mode === 'master' ? 'bg-success/20 text-success' : 'bg-secondary/10 text-secondary group-hover:bg-success/10 group-hover:text-success'}`}>
            <Server size={24} />
          </div>
          <h4 className="font-bold text-foreground text-lg tracking-tight">{t('settings.hostMaster')}</h4>
          <p className="text-xs text-secondary font-medium mt-1.5 leading-relaxed">{t('settings.hostMasterDesc')}</p>
        </div>

        {/* Client Selector */}
        <div
          onClick={() => setMode('client')}
          className={`flex flex-col p-6 rounded-2xl border cursor-pointer transition-all shadow-sm group ${
            mode === 'client'
              ? 'bg-gradient-to-br from-success/5 to-success/10 border-success shadow-success/10 scale-[1.02]'
              : 'bg-card border-border/60 hover:border-success/40 hover:shadow-md'
          }`}
        >
          <div className={`p-3 rounded-xl w-fit mb-4 ${mode === 'client' ? 'bg-success/20 text-success' : 'bg-secondary/10 text-secondary group-hover:bg-success/10 group-hover:text-success'}`}>
            <Laptop size={24} />
          </div>
          <h4 className="font-bold text-foreground text-lg tracking-tight">{t('settings.clientTerminal')}</h4>
          <p className="text-xs text-secondary font-medium mt-1.5 leading-relaxed">{t('settings.clientTerminalDesc')}</p>
        </div>
      </div>

      {mode === 'client' && (
        <div className="bg-card/40 rounded-2xl border border-border/60 p-8 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-8">
          <h4 className="font-black text-foreground text-xl tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 text-success border border-success/20">
              <Activity size={20} />
            </div>
            {t('settings.hostConnSettings')}
          </h4>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2.5 w-full">
                <label className="block text-xs font-bold text-foreground uppercase tracking-widest">
                  {t('settings.hostApiAddress')}
                </label>
                <input
                  type="text"
                  placeholder={t('settings.placeholderHostAddress')}
                  className="w-full bg-card border border-border/60 rounded-xl px-5 py-3.5 text-foreground font-mono outline-none focus:border-success focus:ring-2 focus:ring-success/20 transition-all placeholder:text-secondary/50 shadow-sm"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 shrink-0 w-full lg:w-auto mt-2 lg:mt-0">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="flex-1 lg:flex-none px-6 py-3.5 rounded-xl border border-border/80 bg-card hover:bg-card-hover text-foreground font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:border-success/40 hover:text-success"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw size={18} className="animate-spin text-success" />
                      {t('settings.testing')}
                    </>
                  ) : (
                    t('settings.testConn')
                  )}
                </button>
                <button
                  type="submit"
                  className="flex-1 lg:flex-none px-8 py-3.5 rounded-xl bg-success text-white font-bold tracking-wide text-sm hover:bg-success/90 transition-all shadow-md shadow-success/20 hover:shadow-lg hover:shadow-success/30 hover:-translate-y-0.5"
                >
                  {t('settings.saveHost')}
                </button>
              </div>
            </div>
          </form>

          {pingResult && (
            <div
              className={`p-5 rounded-2xl border flex items-start gap-4 shadow-sm transition-all ${
                pingResult.success
                  ? 'bg-gradient-to-br from-success/5 to-success/10 border-success/30 text-success'
                  : 'bg-gradient-to-br from-danger/5 to-danger/10 border-danger/30 text-danger'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${pingResult.success ? 'bg-success/20' : 'bg-danger/20'}`}>
                {pingResult.success ? (
                  <Wifi size={24} />
                ) : (
                  <WifiOff size={24} />
                )}
              </div>
              <div className="mt-0.5">
                <p className="font-bold text-sm uppercase tracking-widest drop-shadow-sm">
                  {pingResult.success ? t('settings.hostReachable') : t('settings.hostUnreachable')}
                </p>
                <p className="text-xs font-semibold opacity-90 mt-1 leading-relaxed">
                  {pingResult.success
                    ? t('settings.handshakeSuccess').replace(
                        '{latency}',
                        String(pingResult.latency),
                      )
                    : t('settings.handshakeFailed').replace('{error}', pingResult.error || '')}
                </p>
              </div>
            </div>
          )}

          {/* Active Status Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-card/60 rounded-2xl border border-border/60 shadow-sm gap-4">
            <span className="text-sm font-bold text-foreground">
              {t('settings.connectionStatusLabel')}
            </span>
            <div className="flex items-center gap-2.5 bg-background p-2.5 rounded-xl border border-border/40">
              <span
                className={`h-3 w-3 rounded-full shadow-sm ${status === 'online' ? 'bg-success animate-pulse shadow-success/40' : 'bg-danger shadow-danger/40'}`}
              />
              <span className={`text-sm font-black uppercase tracking-widest pr-1 ${status === 'online' ? 'text-success' : 'text-danger'}`}>
                {status === 'online' ? t('settings.onlineSynced') : t('settings.offlineOutage')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Outage Sync Buffer Panel */}
      <div className="bg-card/40 rounded-2xl border border-border/60 p-8 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h4 className="font-black text-foreground text-xl tracking-tight flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success border border-success/20">
                <Database size={20} />
              </div>
              {t('settings.syncBufferTitle')}
            </h4>
            <p className="text-xs text-secondary font-medium">{t('settings.syncBufferDesc')}</p>
          </div>

          {offlineSales.length > 0 && (
            <button
              onClick={handleClearBuffer}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 hover:shadow-sm transition-all mt-1"
            >
              <Trash2 size={14} />
              {t('settings.clearQueue')}
            </button>
          )}
        </div>

        {offlineSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border/60 rounded-2xl bg-card/30">
            <div className="p-4 rounded-full bg-secondary/5 mb-3">
              <AlertCircle size={36} className="text-secondary/50" />
            </div>
            <span className="text-sm text-secondary font-bold tracking-wide">{t('settings.bufferEmpty')}</span>
          </div>
        ) : (
          <div className="overflow-hidden border border-border/60 rounded-2xl shadow-sm bg-card">
            <table className="w-full text-start text-secondary border-collapse">
              <thead className="bg-muted/40 text-[11px] font-black text-secondary uppercase tracking-widest border-b border-border/60">
                <tr>
                  <th className="px-5 py-4 text-start">{t('settings.receiptNum')}</th>
                  <th className="px-5 py-4 text-start">{t('settings.dateTime')}</th>
                  <th className="px-5 py-4 text-start">{t('settings.payment')}</th>
                  <th className="px-5 py-4 text-end">{t('settings.total')}</th>
                  <th className="px-5 py-4 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-sm">
                {offlineSales.map((sale) => (
                  <tr key={sale.id} className="group hover:bg-primary/[0.02] transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-foreground text-xs">
                      {sale.saleData.receipt_number}
                    </td>
                    <td className="px-5 py-4 text-xs text-secondary font-medium">
                      {new Date(sale.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-secondary/10 text-secondary border border-secondary/20 uppercase tracking-widest">
                        {sale.saleData.payment_method}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-end font-black text-foreground text-sm tabular-nums">
                      {Number(sale.saleData.total).toFixed(2)} <span className="text-[10px] text-secondary ml-0.5">EGP</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex justify-center gap-2.5">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1.5 rounded-lg bg-card hover:bg-card-hover border border-border/60 text-secondary hover:text-primary hover:border-primary/40 shadow-sm transition-all"
                          title={t('settings.viewSaleItems')}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => removeOfflineSale(sale.id)}
                          className="p-1.5 rounded-lg bg-danger/5 hover:bg-danger/10 border border-danger/20 text-danger shadow-sm transition-all"
                          title={t('settings.deleteFromBuffer')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-text">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start border-b border-border/40 pb-4">
              <div>
                <h4 className="font-black text-foreground text-xl tracking-tight">
                  {t('settings.bufferedReceipt')}
                </h4>
                <p className="text-xs text-secondary font-mono font-bold mt-1 bg-secondary/10 w-fit px-2 py-0.5 rounded-md border border-secondary/20">
                  {selectedSale.saleData.receipt_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="px-3 py-1.5 rounded-lg text-secondary font-bold hover:text-foreground hover:bg-card-hover border border-transparent hover:border-border/60 transition-all text-xs"
              >
                {t('settings.close')}
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedSale.saleData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start text-sm py-2 border-b border-border/40 last:border-0"
                >
                  <div>
                    <p className="font-bold text-foreground">{item.product_name}</p>
                    <p className="text-xs text-secondary font-medium mt-0.5">
                      <span className="font-bold">{item.quantity}</span> {item.unit} &times; {Number(item.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-black text-foreground text-sm tabular-nums">
                      {Number(item.line_total).toFixed(2)} <span className="text-[10px] text-secondary ml-0.5">EGP</span>
                    </p>
                    {item.discount > 0 && (
                      <p className="text-[11px] font-bold text-danger mt-0.5">
                        -{Number(item.discount).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border/60 space-y-2 text-xs font-medium text-secondary">
              <div className="flex justify-between">
                <span>{t('settings.subtotal')}</span>
                <span className="font-bold text-foreground tabular-nums">
                  {Number(selectedSale.saleData.subtotal).toFixed(2)} EGP
                </span>
              </div>
              {selectedSale.saleData.discount_amount > 0 && (
                <div className="flex justify-between text-danger font-bold">
                  <span>{t('settings.productDiscount')}</span>
                  <span className="tabular-nums">-{Number(selectedSale.saleData.discount_amount).toFixed(2)} EGP</span>
                </div>
              )}
              {selectedSale.saleData.global_discount > 0 && (
                <div className="flex justify-between text-danger font-bold">
                  <span>{t('settings.globalDiscount')}</span>
                  <span className="tabular-nums">-{Number(selectedSale.saleData.global_discount).toFixed(2)} EGP</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-foreground pt-3 border-t border-border/40 mt-2">
                <span>{t('settings.totalAmount')}</span>
                <span className="tabular-nums text-success">{Number(selectedSale.saleData.total).toFixed(2)} <span className="text-[10px] text-secondary ml-0.5 font-bold uppercase">EGP</span></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default LANSettingsScreen;
