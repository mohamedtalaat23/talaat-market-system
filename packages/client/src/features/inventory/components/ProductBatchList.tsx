import { useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/services/api-client';
import { useProducts, type Product } from '@/features/products/hooks/useProductQueries';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Calendar, AlertTriangle, ShieldCheck, Plus, Package, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductBatch {
  id: string;
  product_id: number;
  product_name?: string;
  product_barcode?: string | null;
  product_unit?: string;
  batch_number: string;
  expiration_date: string;
  quantity: number;
  cost_price: number | null;
  received_at: string;
}

/**
 * `apiClient` rejects with a normalised `Error` whose message is the server's
 * `error.message`, so read `.message` (not the raw axios response shape).
 */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ProductBatchList() {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState<number | undefined>(30);
  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(showAddModal);

  // Debounce the product search so the picker does not spam the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(productSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const { data: productResults, isFetching: isSearchingProducts } = useProducts({
    page: 1,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const query = daysFilter ? `?days_to_expiry=${daysFilter}` : '';
      const res = await apiClient.get(`/inventory/batches${query}`);
      setBatches(res.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to fetch product batches'));
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    void fetchBatches();
  }, [fetchBatches]);

  const resetForm = useCallback(() => {
    setSelectedProduct(null);
    setProductSearch('');
    setDebouncedSearch('');
    setNewBatchNumber('');
    setNewExpirationDate('');
    setNewQuantity('');
  }, []);

  const closeModal = useCallback(() => {
    setShowAddModal(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!showAddModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal, closeModal]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !newBatchNumber.trim() || !newExpirationDate || !newQuantity) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (Number(newQuantity) <= 0) {
      toast.error('Batch quantity must be greater than zero');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/inventory/batches', {
        product_id: selectedProduct.id,
        batch_number: newBatchNumber.trim(),
        expiration_date: newExpirationDate,
        quantity: Number(newQuantity),
      });
      toast.success('Batch registered successfully');
      closeModal();
      void fetchBatches();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create batch'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (expDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expDateStr);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <AlertTriangle size={12} /> EXPIRED ({Math.abs(diffDays)}d ago)
        </span>
      );
    }
    if (diffDays <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <AlertTriangle size={12} /> EXPIRING SOON ({diffDays}d left)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <ShieldCheck size={12} /> HEALTHY ({diffDays}d left)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/40 backdrop-blur-md p-4 rounded-2xl border border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">FEFO Batch & Expiration Tracking</h3>
            <p className="text-xs text-muted-foreground">
              Tracks product batch numbers and flags items reaching expiration for FEFO stock
              management.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={daysFilter || ''}
            onChange={(e) => setDaysFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 bg-background border border-border/60 rounded-xl text-xs font-semibold"
          >
            <option value="14">Expiring in 14 days</option>
            <option value="30">Expiring in 30 days</option>
            <option value="90">Expiring in 90 days</option>
            <option value="">All Batches</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-all shadow-sm"
          >
            <Plus size={16} /> Register Batch
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm font-mono animate-pulse">
          Loading product batches...
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border/60 rounded-2xl bg-card/20">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h4 className="font-bold text-foreground mb-1">No Product Batches Found</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            No active product batches match the selected expiration filter window.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-xs font-bold"
          >
            <Plus size={14} /> Add First Batch
          </button>
        </div>
      ) : (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/40 backdrop-blur-md">
          <table className="w-full text-left rtl:text-right text-sm">
            <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4">Batch #</th>
                <th className="py-3.5 px-4">Expiration Date</th>
                <th className="py-3.5 px-4 text-center">Batch Stock</th>
                <th className="py-3.5 px-4 text-right rtl:text-left">FEFO Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {batches.map((batch) => (
                <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-foreground">
                      {batch.product_name || `Product #${batch.product_id}`}
                    </span>
                    {batch.product_barcode && (
                      <span className="block text-xs font-mono text-muted-foreground">
                        {batch.product_barcode}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">
                    {batch.batch_number}
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    {new Date(batch.expiration_date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-foreground">
                    {batch.quantity} {batch.product_unit || 'units'}
                  </td>
                  <td className="py-3.5 px-4 text-right rtl:text-left">
                    {getStatusBadge(batch.expiration_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />

            <div
              ref={focusTrapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="batch-modal-title"
              className="relative z-10 bg-background border border-border/80 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 mb-1">
                <h3 id="batch-modal-title" className="text-lg font-bold text-foreground">
                  Register Product Batch
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Close dialog"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Enter batch credentials and expiration date for stock tracking.
              </p>

              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <label
                    htmlFor="batch-product-search"
                    className="block text-xs font-bold text-muted-foreground mb-1"
                  >
                    Product
                  </label>

                  {selectedProduct ? (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-card border border-border rounded-xl">
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground truncate">
                          {selectedProduct.name}
                        </span>
                        {selectedProduct.barcode && (
                          <span className="block text-[11px] font-mono text-muted-foreground">
                            {selectedProduct.barcode}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(null)}
                        className="text-xs font-bold text-primary hover:underline shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        id="batch-product-search"
                        type="text"
                        placeholder="Search by name or barcode..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold"
                      />

                      <div className="max-h-40 overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40">
                        {isSearchingProducts ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Searching products...
                          </p>
                        ) : (productResults?.data ?? []).length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            No products match this search.
                          </p>
                        ) : (
                          (productResults?.data ?? []).map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => setSelectedProduct(product)}
                              className="w-full text-left rtl:text-right px-3 py-2 hover:bg-muted/40 transition-colors"
                            >
                              <span className="block text-sm font-semibold text-foreground truncate">
                                {product.name}
                              </span>
                              <span className="block text-[11px] font-mono text-muted-foreground">
                                {product.barcode || `#${product.id}`} ·{' '}
                                {product.inventory_quantity ?? 0} {product.unit}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="batch-number"
                    className="block text-xs font-bold text-muted-foreground mb-1"
                  >
                    Batch Number
                  </label>
                  <input
                    id="batch-number"
                    type="text"
                    placeholder="e.g. BATCH-2026-001"
                    value={newBatchNumber}
                    onChange={(e) => setNewBatchNumber(e.target.value)}
                    maxLength={100}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="batch-expiration"
                    className="block text-xs font-bold text-muted-foreground mb-1"
                  >
                    Expiration Date
                  </label>
                  <input
                    id="batch-expiration"
                    type="date"
                    value={newExpirationDate}
                    onChange={(e) => setNewExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="batch-quantity"
                    className="block text-xs font-bold text-muted-foreground mb-1"
                  >
                    Quantity
                  </label>
                  <input
                    id="batch-quantity"
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g. 100"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedProduct}
                    className="px-6 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 disabled:opacity-50"
                  >
                    {submitting ? 'Registering...' : 'Save Batch'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
