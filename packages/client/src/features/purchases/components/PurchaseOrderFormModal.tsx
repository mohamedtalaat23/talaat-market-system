import { useState } from 'react';
import { useCreatePurchaseOrder } from '../hooks/usePurchaseQueries';
import { useSuppliers } from '../../suppliers/hooks/useSupplierQueries';
import { useProducts, Product } from '../../products/hooks/useProductQueries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedItem {
  product_id: number;
  name: string;
  barcode: string | null;
  ordered_quantity: number;
  unit_cost: number;
  current_stock: number;
}

export function PurchaseOrderFormModal({ isOpen, onClose }: PurchaseOrderFormModalProps) {
  const createPO = useCreatePurchaseOrder();
  
  // Suppliers lookup
  const { data: suppliersData } = useSuppliers('', 1, 100);
  const suppliers = suppliersData?.items || [];
  
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<SelectedItem[]>([]);

  // Product search states
  const [productSearch, setProductSearch] = useState('');

  // Construct search filters dynamically
  const productFilters: any = {
    page: 1,
    limit: 8,
  };
  if (productSearch.trim()) {
    productFilters.search = productSearch;
  }

  const { data: productsData } = useProducts(productFilters);
  const matchingProducts = productsData?.data || [];

  const handleAddProduct = (prod: Product) => {
    // Prevent duplicate additions
    if (items.some(item => item.product_id === prod.id)) {
      toast.error('Product already added to this purchase order');
      return;
    }

    setItems([...items, {
      product_id: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      ordered_quantity: 1,
      unit_cost: Number(prod.cost_price || 0),
      current_stock: Number(prod.inventory_quantity || 0)
    }]);

    setProductSearch(''); // Reset search input
  };

  const handleRemoveProduct = (productId: number) => {
    setItems(items.filter(item => item.product_id !== productId));
  };

  const handleUpdateItem = (productId: number, field: keyof SelectedItem, val: number) => {
    setItems(items.map(item => {
      if (item.product_id === productId) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (item.ordered_quantity * item.unit_cost), 0);
  const total = Math.max(0, subtotal - discountAmount + taxAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one product to this order');
      return;
    }

    // Validate quantities and costs
    for (const item of items) {
      if (item.ordered_quantity <= 0) {
        toast.error(`Quantity for product "${item.name}" must be greater than 0`);
        return;
      }
      if (item.unit_cost < 0) {
        toast.error(`Cost price for product "${item.name}" cannot be negative`);
        return;
      }
    }

    const payload = {
      supplier_id: Number(supplierId),
      discount_amount: Number(discountAmount),
      tax_amount: Number(taxAmount),
      notes: notes || null,
      items: items.map(item => ({
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        unit_cost: item.unit_cost
      }))
    };

    createPO.mutate(payload, {
      onSuccess: () => {
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-4xl max-h-[85vh] bg-input border border-border rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-neutral-900/40">
          <h2 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <span>Draft New Purchase Order</span>
          </h2>
          <button onClick={onClose} className="text-secondary hover:text-neutral-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Supplier & Header Config */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-secondary">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full bg-neutral-900 text-neutral-200 border border-border rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-sm"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplier_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-secondary">Discount Amount (EGP)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                placeholder="0.00"
                className="bg-neutral-900 border-border"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-secondary">Tax Amount (EGP)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={taxAmount || ''}
                onChange={(e) => setTaxAmount(Number(e.target.value))}
                placeholder="0.00"
                className="bg-neutral-900 border-border"
              />
            </div>
          </div>

          {/* Product Search & Influx Add */}
          <div className="relative space-y-1.5">
            <label className="text-xs font-semibold text-secondary">Search Products to Add</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                type="text"
                placeholder="Scan barcode or type product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 bg-neutral-900 border-border focus:border-emerald-600"
              />
            </div>

            {/* Matching Products Search overlay list */}
            {productSearch.trim().length > 0 && (
              <div className="absolute left-0 right-0 z-10 max-h-48 overflow-y-auto bg-neutral-900 border border-border rounded-lg shadow-xl divide-y divide-neutral-950">
                {matchingProducts.length === 0 ? (
                  <div className="p-3 text-sm text-neutral-500 text-center">No matching products found</div>
                ) : (
                  matchingProducts.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      className="flex items-center justify-between p-2.5 text-sm hover:bg-card-hover cursor-pointer text-neutral-200 transition-colors"
                    >
                      <div>
                        <div className="font-semibold">{prod.name}</div>
                        <div className="text-xs text-neutral-500 font-mono">
                          Barcode: {prod.barcode || 'N/A'} | Unit: {prod.unit}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-xs font-mono">
                        <span className="text-secondary">Stock: {prod.inventory_quantity}</span>
                        <span className="text-emerald-500 font-bold">{prod.selling_price} EGP</span>
                        <Button size="sm" variant="ghost" className="text-emerald-500 hover:bg-emerald-950/20">
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="rounded-xl border border-border bg-neutral-900/10 overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-neutral-900/40 text-secondary font-semibold">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-center">Barcode</th>
                  <th className="py-2.5 px-3 text-center">Current Stock</th>
                  <th className="py-2.5 px-3 text-center w-28">Cost Price (EGP) *</th>
                  <th className="py-2.5 px-3 text-center w-28">Order Qty *</th>
                  <th className="py-2.5 px-3 text-right">Line Subtotal</th>
                  <th className="py-2.5 px-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      Add products using the search search input above.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.product_id} className="hover:bg-neutral-900/10 text-neutral-300">
                      <td className="py-2 px-3 font-semibold text-neutral-200">{item.name}</td>
                      <td className="py-2 px-3 text-center font-mono text-neutral-500">{item.barcode || 'N/A'}</td>
                      <td className="py-2 px-3 text-center font-mono text-secondary">{item.current_stock}</td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.unit_cost || ''}
                          onChange={(e) => handleUpdateItem(item.product_id, 'unit_cost', Number(e.target.value))}
                          className="bg-input border-border text-center py-1 h-8 text-xs font-mono font-semibold text-emerald-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Input
                          type="number"
                          min="0.001"
                          step="any"
                          required
                          value={item.ordered_quantity || ''}
                          onChange={(e) => handleUpdateItem(item.product_id, 'ordered_quantity', Number(e.target.value))}
                          className="bg-input border-border text-center py-1 h-8 text-xs font-mono font-semibold"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-neutral-100">
                        {new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(item.ordered_quantity * item.unit_cost)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(item.product_id)}
                          className="text-neutral-500 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Notes area */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-secondary">Order Notes / Audit Explanations</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide delivery schedules, terms, or order specifications..."
              rows={2}
              className="w-full bg-neutral-900 text-neutral-200 border border-border rounded-lg py-2 px-3 focus:outline-none focus:border-primary text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-neutral-900/40">
          <div className="flex items-center space-x-6 text-sm font-mono">
            <div className="text-secondary">
              Subtotal: <span className="font-semibold text-neutral-200">{new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(subtotal)}</span>
            </div>
            <div className="text-neutral-100 font-bold text-base">
              Grand Total: <span className="text-emerald-500">{new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(total)}</span>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createPO.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center space-x-1.5"
            >
              <span>Submit Draft</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
