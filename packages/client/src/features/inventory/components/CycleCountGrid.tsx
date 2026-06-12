import React, { useState, useEffect, useRef } from 'react';
import { useCycleCount, useUpdateCycleCountItem, usePostCycleCount, useCancelCycleCount, useScanCycleCountItem } from '../hooks/useCycleCounts';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { Check, X, AlertTriangle, Scan, Search } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { InlineManagerApproval } from '@/features/pos/components/InlineManagerApproval';

interface CycleCountGridProps {
  cycleCountId: string;
  onClose: () => void;
}

export function CycleCountGrid({ cycleCountId, onClose }: CycleCountGridProps) {
  const { data: cycleCount, isLoading } = useCycleCount(cycleCountId);
  const updateItem = useUpdateCycleCountItem();
  const scanItem = useScanCycleCountItem();
  const postBatch = usePostCycleCount();
  const cancelBatch = useCancelCycleCount();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [managerId, setManagerId] = useState<number | ''>('');
  const [pin, setPin] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Aggressive focus trap for scanner
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
         inputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      setBarcodeInput('');
      
      if (!code) return;
      if (!cycleCount) return;

      try {
        // Atomic scan on the backend
        scanItem.mutate({
          cycle_count_id: cycleCountId,
          barcode: code
        });
      } catch (err: any) {
        toast.error('Error scanning item');
      }
    }
  };

  const handleManualQtyChange = async (productId: number, qtyString: string) => {
    let num = Number(qtyString);
    if (isNaN(num) || num < 0) return;
    
    try {
      await updateItem.mutateAsync({
        cycle_count_id: cycleCountId,
        product_id: productId,
        counted_qty: num,
      });
    } catch (err: any) {
      toast.error('Failed to update quantity');
    }
  };

  const handlePost = async () => {
    if (!cycleCount) return;

    try {
      setIsPosting(true);
      const idempotency_key = uuidv4();
      
      const payload: any = {
        cycle_count_id: cycleCountId,
        idempotency_key
      };

      if (managerId && pin) {
        payload.manager_id = managerId;
        payload.pin = pin;
      }

      await postBatch.mutateAsync(payload);
      toast.success('Cycle count posted successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to post cycle count');
    } finally {
      setIsPosting(false);
      setPin('');
    }
  };

  if (isLoading || !cycleCount) return <div className="p-8 text-center">Loading...</div>;

  const isBlind = cycleCount.type === 'blind';
  const totalVariance = cycleCount.items?.reduce((sum, item) => {
    const cost = item.unit_cost ? Number(item.unit_cost) : 0;
    return sum + (Math.abs(Number(item.variance)) * cost);
  }, 0) || 0;

  const requiresManager = totalVariance > 500;
  const requiresAdmin = totalVariance > 5000;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-card border-b border-input-border shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center space-x-2">
            <Scan className="w-6 h-6 text-primary" />
            <span>Batch Cycle Count</span>
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase ml-2">{cycleCount.type}</span>
          </h1>
          <p className="text-sm text-secondary">
            Batch ID: {cycleCount.id.substring(0,8)} | Status: {cycleCount.status.replace('_', ' ').toUpperCase()} | Location: {cycleCount.location || 'Store'}
          </p>
        </div>
        
        <div className="flex space-x-3 items-center">
          <button onClick={onClose} className="px-4 py-2 border border-input-border rounded-lg hover:bg-card-hover transition-colors">
            Save Draft (Esc)
          </button>
          
          <button 
            onClick={() => cancelBatch.mutate(cycleCountId, { onSuccess: onClose })}
            className="px-4 py-2 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Discard Batch</span>
          </button>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Scanner Input Header */}
        <div className="mb-4 bg-card p-4 rounded-xl shadow border border-input-border flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-5 h-5" />
            <input 
              ref={inputRef}
              type="text" 
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Scan barcode or type and press Enter..." 
              className="w-full pl-10 pr-4 py-3 bg-input-bg border-2 border-primary/50 focus:border-primary rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div className="text-sm text-secondary px-4 border-l border-input-border">
            <div>Items Counted: <span className="font-bold text-white">{cycleCount.items?.length || 0}</span></div>
            <div>Total Variance: <span className="font-bold text-white">EGP {totalVariance.toFixed(2)}</span></div>
          </div>
        </div>

        {/* The Spreadsheet */}
        <div className="bg-card rounded-xl border border-input-border shadow overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-card-hover border-b border-input-border">
              <tr>
                <th className="p-3 font-medium text-secondary">Barcode</th>
                <th className="p-3 font-medium text-secondary">Product</th>
                {!isBlind && <th className="p-3 font-medium text-secondary text-right">System Qty</th>}
                <th className="p-3 font-medium text-secondary text-right">Counted Qty</th>
                <th className="p-3 font-medium text-secondary text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {cycleCount.items?.map((item, idx) => {
                const isFocused = selectedItemIndex === idx;
                const v = Number(item.variance);
                return (
                  <tr 
                    key={item.id} 
                    className={`border-b border-input-border/50 hover:bg-card-hover/50 transition-colors ${isFocused ? 'bg-primary/10 ring-1 ring-inset ring-primary' : ''}`}
                    onClick={() => setSelectedItemIndex(idx)}
                  >
                    <td className="p-3 text-secondary">{item.barcode}</td>
                    <td className="p-3 font-medium">{item.product_name}</td>
                    {!isBlind && <td className="p-3 text-right text-secondary">{item.system_qty}</td>}
                    <td className="p-3 text-right">
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.counted_qty}
                        onChange={(e) => handleManualQtyChange(item.product_id, e.target.value)}
                        onFocus={() => setSelectedItemIndex(idx)}
                        className="w-24 bg-input-bg border border-input-border rounded p-1 text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </td>
                    <td className={`p-3 text-right font-medium ${v > 0 ? 'text-success' : v < 0 ? 'text-danger' : 'text-secondary'}`}>
                      {v > 0 ? '+' : ''}{v}
                    </td>
                  </tr>
                );
              })}
              {cycleCount.items?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-secondary">
                    Scan your first item to begin counting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer / Approval Area */}
      <div className="bg-card border-t border-input-border p-4 shadow-lg z-10 flex items-center justify-between">
        <div className="flex-1">
          {requiresManager && (
            <div className="max-w-md">
              <InlineManagerApproval
                managerId={managerId}
                setManagerId={setManagerId}
                pin={pin}
                setPin={setPin}
                isSubmitting={isPosting}
                contextMetadata={
                  <div className="flex flex-col">
                    <div className="font-bold text-warning uppercase flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{requiresAdmin ? 'Admin Approval Required' : 'Manager Approval Required'}</span>
                    </div>
                    <div className="text-secondary text-sm mt-1">
                      Batch Variance Exceeds Limit: EGP {totalVariance.toFixed(2)}
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </div>
        
        <div className="ml-4">
          <button 
            onClick={handlePost}
            disabled={isPosting || ((requiresManager || requiresAdmin) && (!pin || managerId === ''))}
            className="px-8 py-3 bg-success hover:bg-success/90 text-white font-bold rounded-lg shadow-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPosting ? 'Posting...' : (
              <>
                <Check className="w-5 h-5" />
                <span>Submit & Post to Ledger</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
