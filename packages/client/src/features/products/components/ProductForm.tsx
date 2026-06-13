import { useState } from 'react';
import { useCategories, type Product } from '../hooks/useProductQueries';
import { useSuppliers } from '@/features/suppliers/hooks/useSupplierQueries';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/hooks/useTranslation';

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
  const { t, language } = useTranslation();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();

  // Handle standard React input state management
  const [barcode, setBarcode] = useState(initialData?.barcode || '');
  const [name, setName] = useState(initialData?.name || '');
  const [nameAr, setNameAr] = useState(initialData?.name_ar || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.category_id ? String(initialData.category_id) : '',
  );
  const [unit, setUnit] = useState(initialData?.unit || 'pcs');
  const [costPrice, setCostPrice] = useState(
    initialData?.cost_price ? String(initialData.cost_price) : '0',
  );
  const [sellingPrice, setSellingPrice] = useState(
    initialData?.selling_price ? String(initialData.selling_price) : '0',
  );
  const [minStockLevel, setMinStockLevel] = useState(
    initialData?.min_stock_level ? String(initialData.min_stock_level) : '0',
  );
  const [maxStockLevel, setMaxStockLevel] = useState(
    initialData?.max_stock_level ? String(initialData.max_stock_level) : '0',
  );
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [isActive, setIsActive] = useState<boolean>(initialData ? initialData.is_active : true);
  const [supplierId, setSupplierId] = useState<string>(
    initialData?.supplier_id ? String(initialData.supplier_id) : '',
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
      setFormError(t('products.nameRequired'));
      return;
    }

    const costVal = parseFloat(costPrice);
    const sellVal = parseFloat(sellingPrice);
    if (isNaN(costVal) || costVal < 0) {
      setFormError(t('products.costInvalid'));
      return;
    }
    if (isNaN(sellVal) || sellVal < 0) {
      setFormError(t('products.sellingInvalid'));
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
    <form onSubmit={handleSubmit} className="space-y-5 select-text">
      {formError && (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger shadow-sm">
          {formError}
        </div>
      )}

      {/* Grid containing primary fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.nameEnglish')} *
          </label>
          <Input
            id="name"
            placeholder={t('products.placeholderNameEn')}
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="nameAr" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.nameArabic')}
          </label>
          <Input
            id="nameAr"
            placeholder={t('products.placeholderNameAr')}
            className="text-start h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="barcode" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.barcodePLU')}
          </label>
          <Input
            id="barcode"
            placeholder={t('products.placeholderBarcode')}
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="categoryId" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.category').replace(':', '')}
          </label>
          {isLoadingCategories ? (
            <div className="flex h-12 w-full items-center justify-center rounded-xl border border-border/60 bg-background text-xs font-semibold text-neutral-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
              {t('products.loadingTags')}
            </div>
          ) : (
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isLoading}
              className="flex h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
            >
              <option value="">{t('products.noCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {language === 'ar' && cat.name_ar ? cat.name_ar : cat.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="supplierId" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.supplierLabel')}
          </label>
          <div className="flex gap-2">
            <select
              id="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={isLoading}
              className="flex h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
            >
              <option value="">{t('products.noSupplier')}</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id} disabled={sup.status === 'suspended'}>
                  {sup.name} ({sup.supplier_code})
                  {sup.status === 'suspended'
                    ? ` [${t('suppliers.suspended')}]`
                    : sup.status === 'inactive'
                      ? ` [${t('suppliers.inactive')}]`
                      : ''}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t('products.searchSupplier')}
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-1/3 h-12 rounded-xl border border-border/60 bg-background px-4 text-xs font-medium text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
              title="Filter suppliers by name or code"
            />
          </div>
          {selectedSupplier && selectedSupplier.status === 'inactive' && (
            <p className="text-xs text-warning font-bold mt-1.5">
              ⚠️ {t('products.inactiveSupplierWarning')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="unit" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.unit')}
          </label>
          <select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isLoading}
            className="flex h-12 w-full rounded-xl border border-border/60 bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
          >
            <option value="pcs">{t('products.unitPcs')}</option>
            <option value="kg">{t('products.unitKg')}</option>
            <option value="pack">{t('products.unitPack')}</option>
            <option value="bottle">{t('products.unitBottle')}</option>
            <option value="box">{t('products.unitBox')}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="costPrice" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.costPrice')} *
          </label>
          <Input
            id="costPrice"
            type="number"
            step="0.01"
            min="0"
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono text-base"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sellingPrice" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.sellingPrice')} *
          </label>
          <Input
            id="sellingPrice"
            type="number"
            step="0.01"
            min="0"
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono text-base"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        {mode === 'create' && (
          <div className="space-y-1.5">
            <label htmlFor="initialQuantity" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
              {t('products.initialStockLabel')} *
            </label>
            <Input
              id="initialQuantity"
              type="number"
              step="0.001"
              min="0"
              className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono text-base"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="minStock" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.minStockLabel')}
          </label>
          <Input
            id="minStock"
            type="number"
            step="0.001"
            min="0"
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono text-base"
            value={minStockLevel}
            onChange={(e) => setMinStockLevel(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="maxStock" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
            {t('products.maxStockLabel')}
          </label>
          <Input
            id="maxStock"
            type="number"
            step="0.001"
            min="0"
            className="h-12 rounded-xl bg-background border-border/60 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all font-mono text-base"
            value={maxStockLevel}
            onChange={(e) => setMaxStockLevel(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <label htmlFor="description" className="text-xs font-bold text-foreground/80 tracking-wider uppercase">
          {t('products.descLabel')}
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder={t('products.placeholderDesc')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          className="flex w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm text-foreground placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] transition-all"
        />
      </div>

      <div className="flex items-center gap-3 py-3 px-4 bg-background border border-border/60 rounded-xl w-max shadow-sm">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isLoading}
          className="h-5 w-5 rounded border-border/60 bg-background text-primary focus:ring-primary/20 focus:ring-offset-0 cursor-pointer"
        />
        <label htmlFor="isActive" className="text-sm font-bold text-foreground cursor-pointer select-none">
          {t('products.activeLabel')}
        </label>
      </div>

      <div className="flex justify-end gap-3 border-t border-border/40 pt-6 mt-8">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-3 rounded-xl border border-border/60 bg-background text-secondary font-bold text-sm hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-black text-sm uppercase tracking-wider transition-all shadow-[0_4px_14px_rgba(var(--color-primary-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-primary-500),0.4)] disabled:shadow-none disabled:from-neutral-400 disabled:to-neutral-400 hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span>{t('products.saving')}</span>
            </>
          ) : (
            <span>{t('products.saveProduct')}</span>
          )}
        </button>
      </div>
    </form>
  );
}
