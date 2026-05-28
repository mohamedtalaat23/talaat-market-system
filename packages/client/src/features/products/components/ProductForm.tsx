import { useState } from 'react';
import { useCategories, type Product } from '../hooks/useProductQueries';
import { useSuppliers } from '@/features/suppliers/hooks/useSupplierQueries';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

interface ProductFormProps {
  initialData?: Product | undefined;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
}

export function ProductForm({
  initialData,
  onSubmit,
  isLoading,
  mode,
  onCancel,
}: ProductFormProps) {
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();

  // Handle standard React input state management
  const [barcode, setBarcode] = useState(initialData?.barcode || '');
  const [name, setName] = useState(initialData?.name || '');
  const [nameAr, setNameAr] = useState(initialData?.name_ar || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.category_id ? String(initialData.category_id) : ''
  );
  const [unit, setUnit] = useState(initialData?.unit || 'pcs');
  const [costPrice, setCostPrice] = useState(initialData?.cost_price ? String(initialData.cost_price) : '0');
  const [sellingPrice, setSellingPrice] = useState(initialData?.selling_price ? String(initialData.selling_price) : '0');
  const [minStockLevel, setMinStockLevel] = useState(initialData?.min_stock_level ? String(initialData.min_stock_level) : '0');
  const [maxStockLevel, setMaxStockLevel] = useState(initialData?.max_stock_level ? String(initialData.max_stock_level) : '0');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [isActive, setIsActive] = useState<boolean>(initialData ? initialData.is_active : true);
  const [supplierId, setSupplierId] = useState<string>(
    initialData?.supplier_id ? String(initialData.supplier_id) : ''
  );
  const [supplierSearch, setSupplierSearch] = useState('');

  // Fetch active/inactive suppliers to assign
  const { data: suppliersData } = useSuppliers(supplierSearch || undefined, 1, 100);
  const suppliers = suppliersData?.items || [];
  const selectedSupplier = suppliers.find((s) => String(s.id) === supplierId);

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Product name is required');
      return;
    }

    const costVal = parseFloat(costPrice);
    const sellVal = parseFloat(sellingPrice);
    if (isNaN(costVal) || costVal < 0) {
      setFormError('Cost price must be a non-negative number');
      return;
    }
    if (isNaN(sellVal) || sellVal < 0) {
      setFormError('Selling price must be a non-negative number');
      return;
    }

    const payload: any = {
      barcode: barcode.trim() || null,
      name: name.trim(),
      name_ar: nameAr.trim() || null,
      description: description.trim() || null,
      category_id: categoryId ? parseInt(categoryId, 10) : null,
      unit: unit.trim() || 'pcs',
      cost_price: costVal,
      selling_price: sellVal,
      min_stock_level: parseFloat(minStockLevel) || 0,
      max_stock_level: parseFloat(maxStockLevel) || 0,
      is_active: isActive,
      supplier_id: supplierId ? parseInt(supplierId, 10) : null,
    };

    if (mode === 'create') {
      payload.initial_quantity = parseFloat(initialQuantity) || 0;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 select-text">
      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {formError}
        </div>
      )}

      {/* Grid containing primary fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="name" className="text-xs font-semibold text-neutral-300">
            Product Name (English) *
          </label>
          <Input
            id="name"
            placeholder="e.g. Sliced Toast Bread"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="nameAr" className="text-xs font-semibold text-neutral-300">
            Product Name (Arabic)
          </label>
          <Input
            id="nameAr"
            placeholder="مثال: توست شرائح"
            className="text-right"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="barcode" className="text-xs font-semibold text-neutral-300">
            Barcode / PLU
          </label>
          <Input
            id="barcode"
            placeholder="Leave blank for loose produce"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="categoryId" className="text-xs font-semibold text-neutral-300">
            Category
          </label>
          {isLoadingCategories ? (
            <div className="flex h-10 w-full items-center justify-center rounded-md border border-border bg-neutral-900/50 text-xs text-neutral-500">
              Loading categories...
            </div>
          ) : (
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">No Category Selected</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.name_ar ? `(${cat.name_ar})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="supplierId" className="text-xs font-semibold text-neutral-300">
            Primary Supplier
          </label>
          <div className="flex space-x-2">
            <select
              id="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="">No Supplier Assigned</option>
              {suppliers.map((sup) => (
                <option
                  key={sup.id}
                  value={sup.id}
                  disabled={sup.status === 'suspended'}
                >
                  {sup.name} ({sup.supplier_code}){sup.status === 'suspended' ? ' [Suspended]' : sup.status === 'inactive' ? ' [Inactive]' : ''}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-1/3 h-10 rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-xs text-foreground placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              title="Filter suppliers by name or code"
            />
          </div>
          {selectedSupplier && selectedSupplier.status === 'inactive' && (
            <p className="text-[10px] text-amber-500 font-medium mt-1">
              ⚠️ Inactive supplier chosen.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="unit" className="text-xs font-semibold text-neutral-300">
            Unit
          </label>
          <select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="pcs">pcs (pieces)</option>
            <option value="kg">kg (kilograms)</option>
            <option value="pack">pack</option>
            <option value="bottle">bottle</option>
            <option value="box">box</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="costPrice" className="text-xs font-semibold text-neutral-300">
            Cost Price (EGP) *
          </label>
          <Input
            id="costPrice"
            type="number"
            step="0.01"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="sellingPrice" className="text-xs font-semibold text-neutral-300">
            Selling Price (EGP) *
          </label>
          <Input
            id="sellingPrice"
            type="number"
            step="0.01"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        {mode === 'create' && (
          <div className="space-y-1">
            <label htmlFor="initialQuantity" className="text-xs font-semibold text-neutral-300">
              Initial Stock Level *
            </label>
            <Input
              id="initialQuantity"
              type="number"
              step="0.001"
              min="0"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="minStock" className="text-xs font-semibold text-neutral-300">
            Min. Stock Alert Level
          </label>
          <Input
            id="minStock"
            type="number"
            step="0.001"
            min="0"
            value={minStockLevel}
            onChange={(e) => setMinStockLevel(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="maxStock" className="text-xs font-semibold text-neutral-300">
            Max. Stock Alert Level
          </label>
          <Input
            id="maxStock"
            type="number"
            step="0.001"
            min="0"
            value={maxStockLevel}
            onChange={(e) => setMaxStockLevel(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <label htmlFor="description" className="text-xs font-semibold text-neutral-300">
          Description
        </label>
        <textarea
          id="description"
          rows={2}
          placeholder="Product details, storage instructions, etc."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          className="flex w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      <div className="flex items-center space-x-2 py-2">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-primary focus:ring-primary focus:ring-offset-0"
        />
        <label htmlFor="isActive" className="text-sm font-semibold text-neutral-200 cursor-pointer">
          Available for sale (Active)
        </label>
      </div>

      <div className="flex justify-end space-x-2 border-t border-border pt-4 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="font-medium min-w-[80px]"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center space-x-1.5">
              <Spinner size="sm" />
              <span>Saving...</span>
            </div>
          ) : (
            <span>Save Product</span>
          )}
        </Button>
      </div>
    </form>
  );
}
