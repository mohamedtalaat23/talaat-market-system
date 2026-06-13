import { useState, useEffect, useRef } from 'react';
import { useModalStore } from '@/stores/modalStore';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { usePOSStore } from '../usePOSStore';
import { Receipt, X, AlertTriangle, QrCode } from 'lucide-react';
import { useScannerDetection } from '../hooks/useScannerDetection';

interface ScannedItem {
  sku_id: string;
  name: string;
  quantity: number;
  disposition: 'RESTOCK' | 'NON_RESTOCKABLE' | '';
  non_restock_reason: string | null;
  original_sale_line_id: string | null;
  original_sale_id: string | null;
  unit_price: number;
}

export function QuickReturnWorkspace() {
  const isOpen = useModalStore((state) => state.activeModals.pos_quick_return);
  const closeModal = useModalStore((state) => state.closeModal);
  const user = useAuthStore((state) => state.user);
  const registerId = usePOSStore((state) => state.registerId) || '00000000-0000-0000-0000-000000000000';
  
  const [queueId, setQueueId] = useState<string | null>(null);
  const queueInitPromiseRef = useRef<Promise<string> | null>(null); // HUI-1 Fix

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [receiptMode, setReceiptMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // HUI-3: Global Focus Trap
  useEffect(() => {
    if (!isOpen) return;
    const focusTrap = () => {
      if (receiptMode) inputRef.current?.focus();
      else document.body.focus();
    };
    window.addEventListener('click', focusTrap);
    // Auto-focus on mount based on mode
    focusTrap();
    return () => window.removeEventListener('click', focusTrap);
  }, [isOpen, receiptMode]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setQueueId(null);
      queueInitPromiseRef.current = null;
      setItems([]);
      setReceiptMode(false);
    }
  }, [isOpen]);

  // HUI-1: Queue Multiplication Lock
  const ensureQueue = async (type: 'RECEIPT' | 'UNRECEIPTED') => {
    if (queueId) return queueId;
    if (queueInitPromiseRef.current) return queueInitPromiseRef.current;
    
    queueInitPromiseRef.current = (async () => {
      try {
        const res = await apiClient.post<{ success: boolean; data: any }>('/return-queues', {
          register_id: registerId,
          queue_type: type
        });
        setQueueId(res.data.data.queue_id);
        return res.data.data.queue_id;
      } catch (e) {
        queueInitPromiseRef.current = null;
        throw e;
      }
    })();
    return queueInitPromiseRef.current;
  };

  // HUI-2: Immediate Sync Model
  const syncItem = async (qId: string, item: any, qtyAdjustment: number) => {
    await apiClient.post(`/return-queues/${qId}/scan`, {
      sku_id: item.sku_id,
      quantity: qtyAdjustment,
      disposition: item.disposition,
      non_restock_reason: item.non_restock_reason,
      original_sale_line_id: item.original_sale_line_id,
      original_sale_id: item.original_sale_id
    });
  };

  // HUI-5: Uncontrolled Scanner Detection
  const handleScanItem = async (barcode: string) => {
    if (!isOpen || receiptMode) return;
    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(`/products/barcode/${barcode}`);
      const product = res.data.data;
      if (!product) throw new Error('Product not found');

      const qId = await ensureQueue('UNRECEIPTED');
      
      const payload = {
        sku_id: product.id,
        quantity: 1,
        disposition: 'RESTOCK',
        non_restock_reason: null,
      };
      
      // Immediate sync
      await syncItem(qId, payload, 1);

      setItems(prev => {
        const existing = prev.findIndex(i => i.sku_id === product.id && i.disposition === 'RESTOCK');
        if (existing >= 0) {
          const newItems = [...prev];
          newItems[existing]!.quantity += 1;
          return newItems;
        }
        return [...prev, {
          ...payload,
          name: product.name,
          original_sale_line_id: null,
          original_sale_id: null,
          unit_price: Number(product.selling_price)
        } as ScannedItem];
      });
    } catch (e: any) {
      toast.error(e.message || 'Error scanning item');
    }
  };

  useScannerDetection({ onScan: handleScanItem, timeThreshold: 30 });

  const handleLookupReceipt = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const receiptId = e.currentTarget.value;
    if (!receiptId) return;

    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(`/pos/receipts/${receiptId}`);
      if (!res.data.data) throw new Error('Receipt not found');
      
      const sale = res.data.data;
      const qId = await ensureQueue('RECEIPT');
      
      // Load transaction lines into grid directly and auto-sync them as draft returns
      const newItems: ScannedItem[] = sale.lines.map((l: any) => ({
        sku_id: l.product_id,
        name: l.product_name,
        quantity: l.quantity,
        disposition: 'RESTOCK',
        non_restock_reason: null,
        original_sale_line_id: l.id,
        original_sale_id: sale.id,
        unit_price: Number(l.unit_price)
      }));
      
      for (const item of newItems) {
         await syncItem(qId, item, item.quantity);
      }

      setItems(newItems);
      toast.success('Transaction loaded');
    } catch (e: any) {
      toast.error(e.message || 'Error loading receipt');
    }
  };

  const updateDisposition = async (idx: number, disposition: any, reason: string | null) => {
     if (!queueId) return;
     const newItems = [...items];
     newItems[idx]!.disposition = disposition;
     newItems[idx]!.non_restock_reason = reason;
     setItems(newItems);

     // Sync to backend instantly with 0 quantity adjustment but updated disposition
     try {
       await syncItem(queueId, newItems[idx], 0);
     } catch (e: any) {
       toast.error('Failed to sync disposition');
     }
  };

  // HUI-2: O(1) Submit
  const handleSubmit = async () => {
    if (!queueId) {
      toast.error('Queue is empty');
      return;
    }
    
    const missing = items.find(i => !i.disposition || (i.disposition === 'NON_RESTOCKABLE' && !i.non_restock_reason));
    if (missing) {
      toast.error('Missing disposition or reason on some items');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/return-queues/${queueId}/submit`);
      toast.success('Return Queue Submitted to Manager');
      closeModal('pos_quick_return');
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Failed to submit queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (queueId && items.length > 0) {
           apiClient.post(`/return-queues/${queueId}/cancel`).catch(() => {});
        }
        closeModal('pos_quick_return');
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setReceiptMode(true);
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, queueId, items]);

  if (!isOpen) return null;

  const totalRefund = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="flex w-full h-[90vh] max-w-7xl overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-800">
        
        {/* Left Panel (65%) */}
        <div className="flex flex-col w-[65%] border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-indigo-400" />
              Quick Return Workspace
            </h2>
            <div className="flex items-center gap-4">
              <button onClick={() => setReceiptMode(true)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${receiptMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-300'}`}>
                Receipt Mode [F8]
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-slate-800 bg-slate-950/30">
            {receiptMode ? (
               <input
                 ref={inputRef}
                 type="text"
                 onKeyDown={handleLookupReceipt}
                 placeholder="Scan Receipt Barcode and press Enter..."
                 className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg shadow-inner"
                 autoFocus
               />
            ) : (
               <div className="w-full bg-slate-900 border border-slate-700 text-slate-400 px-4 py-4 rounded-xl text-lg shadow-inner flex items-center gap-3">
                 <QrCode className="w-6 h-6" />
                 Scanner active... Please scan items.
               </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <QrCode className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No items scanned</p>
                <p className="text-sm">Scan items or press F8 for receipt lookup</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="pb-3 px-2 font-medium">Item</th>
                    <th className="pb-3 px-2 font-medium text-center">Qty</th>
                    <th className="pb-3 px-2 font-medium">Disposition</th>
                    <th className="pb-3 px-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {items.map((item, idx) => (
                    <tr key={idx} className={`group hover:bg-slate-800/30 transition-colors ${!item.disposition || (item.disposition === 'NON_RESTOCKABLE' && !item.non_restock_reason) ? 'bg-red-500/10' : ''}`}>
                      <td className="py-4 px-2 text-slate-200 font-medium">{item.name}</td>
                      <td className="py-4 px-2 text-center text-slate-300">{item.quantity}</td>
                      <td className="py-4 px-2">
                        <select 
                          className="bg-slate-800 border-none rounded text-sm text-slate-200 p-2 focus:ring-1 focus:ring-indigo-500 w-full"
                          value={item.disposition}
                          onChange={(e) => updateDisposition(idx, e.target.value, e.target.value === 'RESTOCK' ? null : item.non_restock_reason)}
                        >
                          <option value="" disabled>Select...</option>
                          <option value="RESTOCK">RESTOCK</option>
                          <option value="NON_RESTOCKABLE">WRITE-OFF</option>
                        </select>
                      </td>
                      <td className="py-4 px-2">
                        {item.disposition === 'NON_RESTOCKABLE' && (
                          <select 
                            className="bg-slate-800 border-none rounded text-sm text-slate-200 p-2 focus:ring-1 focus:ring-red-500 w-full ring-1 ring-red-500/30"
                            value={item.non_restock_reason || ''}
                            onChange={(e) => updateDisposition(idx, item.disposition, e.target.value)}
                          >
                            <option value="" disabled>Required...</option>
                            <option value="DAMAGED">DAMAGED</option>
                            <option value="EXPIRED">EXPIRED</option>
                            <option value="OPENED">OPENED</option>
                            <option value="CONTAMINATED">CONTAMINATED</option>
                            <option value="SUPPLIER_RECALL">RECALL</option>
                            <option value="CUSTOMER_DISSATISFACTION">DISSATISFACTION</option>
                            <option value="OTHER">OTHER</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panel (35%) */}
        <div className="flex flex-col w-[35%] bg-slate-950 p-6">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Queue Status</h3>
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500"></span>
                <span className="text-white font-semibold">OPEN (DRAFT)</span>
              </div>
            </div>
            <button onClick={() => closeModal('pos_quick_return')} className="p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm">
              <p className="text-slate-400 text-sm font-medium mb-1">Total Refund Value</p>
              <p className="text-4xl font-bold text-white tracking-tight">EGP {totalRefund.toFixed(2)}</p>
            </div>
            
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
               <div className="flex justify-between">
                 <span className="text-slate-400">Total Items</span>
                 <span className="text-white font-semibold">{items.reduce((acc, i) => acc + i.quantity, 0)}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-400">Queue Type</span>
                 <span className="text-white font-semibold">{receiptMode ? 'RECEIPTED' : 'UNRECEIPTED'}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-400">Owner</span>
                 <span className="text-white font-semibold">{(user as any)?.first_name || (user as any)?.name || 'Cashier'}</span>
               </div>
            </div>

            {items.some(i => !i.disposition || (i.disposition === 'NON_RESTOCKABLE' && !i.non_restock_reason)) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                 <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                 <div>
                   <p className="text-red-400 font-medium text-sm">Action Required</p>
                   <p className="text-red-400/80 text-xs mt-1">Some items are missing disposition or reason codes.</p>
                 </div>
              </div>
            )}
          </div>

          <div className="space-y-3 mt-6">
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || items.length === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-2 text-lg"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to Manager'}
              <span className="text-emerald-200 text-sm ml-2 font-normal hidden sm:inline">(Ctrl+Enter)</span>
            </button>
            <button 
              onClick={() => closeModal('pos_quick_return')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-4 rounded-xl transition-colors"
            >
              Cancel Return (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
