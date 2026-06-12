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
    <div className="space-y-8 max-w-4xl text-input-text select-text">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-input-text mb-2 flex items-center gap-2">
          <Wifi className="text-success" size={24} />
          {t('settings.lanTitle')}
        </h3>
        <p className="text-sm text-secondary">{t('settings.lanDesc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Standalone Selector */}
        <div
          onClick={() => setMode('standalone')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'standalone'
              ? 'bg-card border-success ring-1 ring-success'
              : 'bg-background/40 border-input-border hover:border-input-border'
          }`}
        >
          <Monitor
            size={24}
            className={`mb-3 ${mode === 'standalone' ? 'text-success' : 'text-secondary'}`}
          />
          <h4 className="font-semibold text-input-text">{t('settings.standalone')}</h4>
          <p className="text-xs text-secondary mt-1">{t('settings.standaloneDesc')}</p>
        </div>

        {/* Master Selector */}
        <div
          onClick={() => setMode('master')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'master'
              ? 'bg-card border-success ring-1 ring-success'
              : 'bg-background/40 border-input-border hover:border-input-border'
          }`}
        >
          <Server
            size={24}
            className={`mb-3 ${mode === 'master' ? 'text-success' : 'text-secondary'}`}
          />
          <h4 className="font-semibold text-input-text">{t('settings.hostMaster')}</h4>
          <p className="text-xs text-secondary mt-1">{t('settings.hostMasterDesc')}</p>
        </div>

        {/* Client Selector */}
        <div
          onClick={() => setMode('client')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'client'
              ? 'bg-card border-success ring-1 ring-success'
              : 'bg-background/40 border-input-border hover:border-input-border'
          }`}
        >
          <Laptop
            size={24}
            className={`mb-3 ${mode === 'client' ? 'text-success' : 'text-secondary'}`}
          />
          <h4 className="font-semibold text-input-text">{t('settings.clientTerminal')}</h4>
          <p className="text-xs text-secondary mt-1">{t('settings.clientTerminalDesc')}</p>
        </div>
      </div>

      {mode === 'client' && (
        <div className="bg-card/50 rounded-xl border border-input-border p-6 space-y-6">
          <h4 className="font-bold text-input-text flex items-center gap-2">
            <Activity size={18} className="text-success" />
            {t('settings.hostConnSettings')}
          </h4>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('settings.hostApiAddress')}
                </label>
                <input
                  type="text"
                  placeholder={t('settings.placeholderHostAddress')}
                  className="w-full bg-input-bg border border-input-border rounded-lg px-4 py-2.5 text-input-text outline-none focus:border-input-focus transition-colors placeholder:text-input-placeholder"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-4 py-2.5 rounded-lg border border-input-border bg-card hover:bg-card-hover text-input-text font-semibold text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-secondary" />
                      {t('settings.testing')}
                    </>
                  ) : (
                    t('settings.testConn')
                  )}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-success text-white font-semibold text-sm hover:bg-success/90 transition-colors"
                >
                  {t('settings.saveHost')}
                </button>
              </div>
            </div>
          </form>

          {pingResult && (
            <div
              className={`p-4 rounded-lg border flex items-start gap-3 ${
                pingResult.success
                  ? 'bg-success/15 border-success/30 text-success'
                  : 'bg-danger/10 border-danger/50 text-danger'
              }`}
            >
              {pingResult.success ? (
                <Wifi size={20} className="text-success mt-0.5 shrink-0" />
              ) : (
                <WifiOff size={20} className="text-danger mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {pingResult.success ? t('settings.hostReachable') : t('settings.hostUnreachable')}
                </p>
                <p className="text-xs text-secondary mt-0.5">
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
          <div className="flex items-center justify-between p-4 bg-background/60 rounded-lg border border-input-border/50">
            <span className="text-sm font-medium text-secondary">
              {t('settings.connectionStatusLabel')}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${status === 'online' ? 'bg-success/90 animate-pulse' : 'bg-danger'}`}
              />
              <span className="text-sm font-bold uppercase tracking-wider">
                {status === 'online' ? t('settings.onlineSynced') : t('settings.offlineOutage')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Outage Sync Buffer Panel */}
      <div className="bg-card/50 rounded-xl border border-input-border p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h4 className="font-bold text-input-text flex items-center gap-2">
              <Database size={18} className="text-success" />
              {t('settings.syncBufferTitle')}
            </h4>
            <p className="text-xs text-secondary">{t('settings.syncBufferDesc')}</p>
          </div>

          {offlineSales.length > 0 && (
            <button
              onClick={handleClearBuffer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/10 border border-danger/25 text-danger hover:bg-danger/20 transition-colors"
            >
              <Trash2 size={13} />
              {t('settings.clearQueue')}
            </button>
          )}
        </div>

        {offlineSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-input-border rounded-lg bg-background/10">
            <AlertCircle size={32} className="text-slate-600 mb-2" />
            <span className="text-sm text-slate-500 font-medium">{t('settings.bufferEmpty')}</span>
          </div>
        ) : (
          <div className="overflow-hidden border border-input-border rounded-lg">
            <table className="w-full text-start text-secondary border-collapse">
              <thead className="bg-background text-xs font-bold text-secondary uppercase tracking-wider border-b border-input-border">
                <tr>
                  <th className="px-4 py-3 text-start">{t('settings.receiptNum')}</th>
                  <th className="px-4 py-3 text-start">{t('settings.dateTime')}</th>
                  <th className="px-4 py-3 text-start">{t('settings.payment')}</th>
                  <th className="px-4 py-3 text-end">{t('settings.total')}</th>
                  <th className="px-4 py-3 text-center">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/20 text-sm">
                {offlineSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-card-hover/40">
                    <td className="px-4 py-3 font-mono font-bold text-input-text text-xs">
                      {sale.saleData.receipt_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {new Date(sale.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-card-hover text-secondary border border-input-border capitalize">
                        {sale.saleData.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-bold text-input-text text-xs">
                      {Number(sale.saleData.total).toFixed(2)} EGP
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1 rounded bg-card hover:bg-card-hover border border-input-border text-secondary hover:text-input-text"
                          title={t('settings.viewSaleItems')}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => removeOfflineSale(sale.id)}
                          className="p-1 rounded bg-danger/10 hover:bg-danger/25 border border-danger/25 text-danger hover:text-danger"
                          title={t('settings.deleteFromBuffer')}
                        >
                          <Trash2 size={14} />
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 backdrop-blur-[1px] p-4 select-text">
          <div className="w-full max-w-lg rounded-xl border border-input-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-input-border pb-3">
              <div>
                <h4 className="font-bold text-input-text text-lg">
                  {t('settings.bufferedReceipt')}
                </h4>
                <p className="text-xs text-secondary font-mono mt-0.5">
                  {selectedSale.saleData.receipt_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="px-2 py-1 rounded text-secondary hover:text-input-text hover:bg-card-hover text-xs"
              >
                {t('settings.close')}
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {selectedSale.saleData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start text-sm py-1.5 border-b border-input-border/40"
                >
                  <div>
                    <p className="font-semibold text-input-text">{item.product_name}</p>
                    <p className="text-xs text-secondary mt-0.5">
                      {item.quantity} {item.unit} x {Number(item.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold text-input-text text-xs">
                      {Number(item.line_total).toFixed(2)} EGP
                    </p>
                    {item.discount > 0 && (
                      <p className="text-xs text-danger">
                        -{Number(item.discount).toFixed(2)} Discount
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-input-border space-y-1.5 text-xs text-secondary">
              <div className="flex justify-between">
                <span>{t('settings.subtotal')}</span>
                <span className="font-medium text-input-text">
                  {Number(selectedSale.saleData.subtotal).toFixed(2)} EGP
                </span>
              </div>
              {selectedSale.saleData.discount_amount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>{t('settings.productDiscount')}</span>
                  <span>-{Number(selectedSale.saleData.discount_amount).toFixed(2)} EGP</span>
                </div>
              )}
              {selectedSale.saleData.global_discount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>{t('settings.globalDiscount')}</span>
                  <span>-{Number(selectedSale.saleData.global_discount).toFixed(2)} EGP</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-input-text pt-1 border-t border-input-border/40">
                <span>{t('settings.totalAmount')}</span>
                <span>{Number(selectedSale.saleData.total).toFixed(2)} EGP</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default LANSettingsScreen;
