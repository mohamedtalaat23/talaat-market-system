import { useState } from 'react';
import { useLANStore, OfflineSale } from '@/features/pos/stores/useLANStore';
import toast from 'react-hot-toast';
import { Wifi, WifiOff, Monitor, Server, Laptop, Activity, Database, AlertCircle, RefreshCw, Trash2, Eye } from 'lucide-react';

export function LANSettingsScreen() {
  const { mode, hostAddress, status, offlineSales, setMode, setHostAddress, clearOfflineSales, removeOfflineSale } = useLANStore();
  const [addressInput, setAddressInput] = useState(hostAddress);
  const [testingConnection, setTestingConnection] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
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
      toast.error('Please enter a valid HTTP/HTTPS URL (e.g. ' + 'http' + '://192.168.1.50:3001)');
      return;
    }
    setHostAddress(addressInput);
    toast.success('LAN settings configuration saved');
  };

  const handleTestConnection = async () => {
    if (!isValidUrl(addressInput)) {
      toast.error('Please specify a valid Host Address URL to ping');
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
        signal: AbortSignal.timeout(4000)
      });

      const latency = Date.now() - startTime;
      if (response.ok) {
        setPingResult({ success: true, latency });
        toast.success(`Ping successful! Latency: ${latency}ms`);
      } else {
        throw new Error(`Server returned status code ${response.status}`);
      }
    } catch (error: any) {
      setPingResult({
        success: false,
        error: error.message || 'Host unreachable or health endpoint not found'
      });
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleClearBuffer = () => {
    if (window.confirm('Are you absolutely sure you want to clear the entire offline sync buffer? This will delete all pending offline transactions.')) {
      clearOfflineSales();
      toast.success('Offline sync buffer cleared');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl text-foreground">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
          <Wifi className="text-emerald-500" size={24} />
          LAN & Terminal Synchronization
        </h3>
        <p className="text-sm text-secondary">
          Configure multi-terminal registers to process sales and track inventories locally or route checkouts to a Host Master Server.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Standalone Selector */}
        <div 
          onClick={() => setMode('standalone')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'standalone' 
              ? 'bg-card border-emerald-600 ring-1 ring-emerald-500/30' 
              : 'bg-background/40 border-border hover:border-border'
          }`}
        >
          <Monitor size={24} className={`mb-3 ${mode === 'standalone' ? 'text-emerald-400' : 'text-secondary'}`} />
          <h4 className="font-semibold text-foreground">Standalone Register</h4>
          <p className="text-xs text-secondary mt-1">
            Standard single PC register setup. Operations run strictly against the local database on this device.
          </p>
        </div>

        {/* Master Selector */}
        <div 
          onClick={() => setMode('master')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'master' 
              ? 'bg-card border-emerald-600 ring-1 ring-emerald-500/30' 
              : 'bg-background/40 border-border hover:border-border'
          }`}
        >
          <Server size={24} className={`mb-3 ${mode === 'master' ? 'text-emerald-400' : 'text-secondary'}`} />
          <h4 className="font-semibold text-foreground">Host Master Server</h4>
          <p className="text-xs text-secondary mt-1">
            Hosts the central inventory. Other client registers on the local network synchronize and post sales here.
          </p>
        </div>

        {/* Client Selector */}
        <div 
          onClick={() => setMode('client')}
          className={`flex flex-col p-5 rounded-xl border cursor-pointer transition-all ${
            mode === 'client' 
              ? 'bg-card border-emerald-600 ring-1 ring-emerald-500/30' 
              : 'bg-background/40 border-border hover:border-border'
          }`}
        >
          <Laptop size={24} className={`mb-3 ${mode === 'client' ? 'text-emerald-400' : 'text-secondary'}`} />
          <h4 className="font-semibold text-foreground">Client Terminal Register</h4>
          <p className="text-xs text-secondary mt-1">
            Sync-register. Routes checkout and stock mutations to the Host Master IP over the local network (LAN).
          </p>
        </div>
      </div>

      {mode === 'client' && (
        <div className="bg-card/50 rounded-xl border border-border p-6 space-y-6">
          <h4 className="font-bold text-foreground flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            Host Connection Settings
          </h4>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider">Host Master API Address</label>
                <input
                  type="text"
                  placeholder={'e.g., ' + 'http' + '://192.168.1.50:3001'}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground outline-none focus:border-emerald-500/60 transition-colors"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-card-hover text-foreground font-semibold text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-secondary" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors"
                >
                  Save Host
                </button>
              </div>
            </div>
          </form>

          {pingResult && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${
              pingResult.success 
                ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-300' 
                : 'bg-red-950/20 border-red-800/80 text-red-300'
            }`}>
              {pingResult.success ? (
                <Wifi size={20} className="text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <WifiOff size={20} className="text-red-400 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {pingResult.success ? 'Host Reachable & Online' : 'Cannot Reach Host Server'}
                </p>
                <p className="text-xs text-secondary mt-0.5">
                  {pingResult.success 
                    ? `Successful handshake response in ${pingResult.latency}ms.` 
                    : `Ping failed: ${pingResult.error}`}
                </p>
              </div>
            </div>
          )}

          {/* Active Status Badge */}
          <div className="flex items-center justify-between p-4 bg-background/60 rounded-lg border border-border/50">
            <span className="text-sm font-medium text-secondary">Terminal Register Connection Status:</span>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-bold uppercase tracking-wider">
                {status === 'online' ? 'Online (Synched)' : 'Offline (Outage Buffer Active)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Outage Sync Buffer Panel */}
      <div className="bg-card/50 rounded-xl border border-border p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h4 className="font-bold text-foreground flex items-center gap-2">
              <Database size={18} className="text-emerald-400" />
              Offline Outage Sync Buffer
            </h4>
            <p className="text-xs text-secondary">
              Transactions generated locally when the master server was disconnected. They will sync automatically once online.
            </p>
          </div>

          {offlineSales.length > 0 && (
            <button
              onClick={handleClearBuffer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-danger/10 border border-danger/25 text-danger hover:bg-danger/20 transition-colors"
            >
              <Trash2 size={13} />
              Clear Queue
            </button>
          )}
        </div>

        {offlineSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-background/10">
            <AlertCircle size={32} className="text-slate-600 mb-2" />
            <span className="text-sm text-slate-500 font-medium">Sync queue empty. No buffered offline sales.</span>
          </div>
        ) : (
          <div className="overflow-hidden border border-border rounded-lg">
            <table className="w-full text-left text-secondary border-collapse">
              <thead className="bg-background text-xs font-bold text-secondary uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Receipt Number</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background/20 text-sm">
                {offlineSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-card-hover/40">
                    <td className="px-4 py-3 font-mono font-bold text-foreground text-xs">{sale.saleData.receipt_number}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{new Date(sale.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-card-hover text-secondary border border-border capitalize">
                        {sale.saleData.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground text-xs">
                      {Number(sale.saleData.total).toFixed(2)} EGP
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="p-1 rounded bg-card hover:bg-card-hover border border-border text-secondary hover:text-foreground"
                          title="View sale items"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => removeOfflineSale(sale.id)}
                          className="p-1 rounded bg-danger/10 hover:bg-danger/25 border border-danger/25 text-danger hover:text-danger"
                          title="Delete from buffer"
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
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h4 className="font-bold text-foreground text-lg">Buffered Sale Receipt</h4>
                <p className="text-xs text-secondary font-mono mt-0.5">{selectedSale.saleData.receipt_number}</p>
              </div>
              <button 
                onClick={() => setSelectedSale(null)}
                className="px-2 py-1 rounded text-secondary hover:text-foreground hover:bg-card-hover text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {selectedSale.saleData.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm py-1.5 border-b border-border/40">
                  <div>
                    <p className="font-semibold text-foreground">{item.product_name}</p>
                    <p className="text-xs text-secondary mt-0.5">
                      {item.quantity} {item.unit} x {Number(item.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-xs">{Number(item.line_total).toFixed(2)} EGP</p>
                    {item.discount > 0 && (
                      <p className="text-[10px] text-red-400">-{Number(item.discount).toFixed(2)} Discount</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border space-y-1.5 text-xs text-secondary">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium text-foreground">{Number(selectedSale.saleData.subtotal).toFixed(2)} EGP</span>
              </div>
              {selectedSale.saleData.discount_amount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Product Discount:</span>
                  <span>-{Number(selectedSale.saleData.discount_amount).toFixed(2)} EGP</span>
                </div>
              )}
              {selectedSale.saleData.global_discount > 0 && (
                <div className="flex justify-between text-red-400">
                  <span>Global Discount:</span>
                  <span>-{Number(selectedSale.saleData.global_discount).toFixed(2)} EGP</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/40">
                <span>Total Amount:</span>
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
