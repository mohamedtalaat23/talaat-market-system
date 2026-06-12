import { useState } from 'react';
import { useCategories, type Product } from '../hooks/useProductQueries';
import { useSuppliers } from '@/features/suppliers/hooks/useSupplierQueries';
import { Button } from '@/components/ui/Button';
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
    <form onSubmit={handleSubmit} className="space-y-4 select-text">
      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {formError}
        </div>
      )}

      {/* Grid containing primary fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="name" className="text-xs font-semibold text-secondary">
            {t('products.nameEnglish')} *
          </label>
          <Input
            id="name"
            placeholder={t('products.placeholderNameEn')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="nameAr" className="text-xs font-semibold text-secondary">
            {t('products.nameArabic')}
          </label>
          <Input
            id="nameAr"
            placeholder={t('products.placeholderNameAr')}
            className="text-start"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="barcode" className="text-xs font-semibold text-secondary">
            {t('products.barcodePLU')}
          </label>
          <Input
            id="barcode"
            placeholder={t('products.placeholderBarcode')}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="categoryId" className="text-xs font-semibold text-secondary">
            {t('products.category').replace(':', '')}
          </label>
          {isLoadingCategories ? (
            <div className="flex h-10 w-full items-center justify-center rounded-md border border-input-border bg-input-bg text-xs text-neutral-500">
              {t('products.loadingTags')}
            </div>
          ) : (
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
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

        <div className="space-y-1">
          <label htmlFor="supplierId" className="text-xs font-semibold text-secondary">
            {t('products.supplierLabel')}
          </label>
          <div className="flex gap-2">
            <select
              id="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
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
              className="w-1/3 h-10 rounded-md border border-input-border bg-input-bg px-3 py-2 text-xs text-input-text placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent"
              title="Filter suppliers by name or code"
            />
          </div>
          {selectedSupplier && selectedSupplier.status === 'inactive' && (
            <p className="text-xs text-warning font-medium mt-1">
              ⚠️ {t('products.inactiveSupplierWarning')}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="unit" className="text-xs font-semibold text-secondary">
            {t('products.unit')}
          </label>
          <select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
          >
            <option value="pcs">{t('products.unitPcs')}</option>
            <option value="kg">{t('products.unitKg')}</option>
            <option value="pack">{t('products.unitPack')}</option>
            <option value="bottle">{t('products.unitBottle')}</option>
            <option value="box">{t('products.unitBox')}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="costPrice" className="text-xs font-semibold text-secondary">
            {t('products.costPrice')} *
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
          <label htmlFor="sellingPrice" className="text-xs font-semibold text-secondary">
            {t('products.sellingPrice')} *
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
            <label htmlFor="initialQuantity" className="text-xs font-semibold text-secondary">
              {t('products.initialStockLabel')} *
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
          <label htmlFor="minStock" className="text-xs font-semibold text-secondary">
            {t('products.minStockLabel')}
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
          <label htmlFor="maxStock" className="text-xs font-semibold text-secondary">
            {t('products.maxStockLabel')}
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
        <label htmlFor="description" className="text-xs font-semibold text-secondary">
          {t('products.descLabel')}
        </label>
        <textarea
          id="description"
          rows={2}
          placeholder={t('products.placeholderDesc')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
          className="flex w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
        />
      </div>

      <div className="flex items-center gap-2 py-2">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-input-border bg-input-bg text-primary focus:ring-primary/20 focus:ring-offset-0"
        />
        <label htmlFor="isActive" className="text-sm font-semibold text-input-text cursor-pointer">
          {t('products.activeLabel')}
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-input-border pt-4 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="font-medium min-w-[80px]" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <Spinner size="sm" />
              <span>{t('products.saving')}</span>
            </div>
          ) : (
            <span>{t('products.saveProduct')}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
