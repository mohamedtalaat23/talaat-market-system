import { useSearchParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { History, Calendar, ClipboardList, LayoutGrid } from 'lucide-react';
import {
  useInventory,
  useInventoryCategories,
  type InventoryItem,
} from './hooks/useInventoryQueries';
import { InventoryTable } from './components/InventoryTable';
import { InventoryAdjustmentModal } from './components/InventoryAdjustmentModal';
import { AdjustmentHistoryViewer } from './components/AdjustmentHistoryViewer';
import { InventoryFilterBar } from './components/InventoryFilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { useModalStore } from '@/stores/modalStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CycleCountBatchList } from './components/CycleCountBatchList';
import { ProductBatchList } from './components/ProductBatchList';

/**
 * Inventory Levels management orchestrator.
 * Delegates list filtration, pagination, and overlays to subcomponents.
 */
export function InventoryPage() {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState(params.get('search') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showLowStock, setShowLowStock] = useState(params.get('low_stock') === 'true');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<'stock' | 'cycle_counts' | 'batches'>(
    params.get('tab') === 'batches'
      ? 'batches'
      : params.get('tab') === 'cycle_counts'
        ? 'cycle_counts'
        : 'stock',
  );

  const openModal = useModalStore((state) => state.openModal);

  // TanStack Query list fetchers
  const { data: categories = [], isLoading: isLoadingCategories } = useInventoryCategories();

  // Memoize filters to stabilize reference and prevent infinite render loops
  const queryFilters = useMemo(
    () => ({
      page,
      limit,
      search: debouncedSearch,
      category_id: selectedCategoryId,
      low_stock_only: showLowStock,
      sortBy,
      sortOrder,
    }),
    [page, limit, debouncedSearch, selectedCategoryId, showLowStock, sortBy, sortOrder],
  );

  const {
    data: inventoryData,
    isLoading: isLoadingInventory,
    error,
    refetch,
  } = useInventory(queryFilters);

  const items = inventoryData?.data || [];
  const meta = inventoryData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleClearFilters = () => {
    setDebouncedSearch('');
    setSelectedCategoryId(null);
    setShowLowStock(false);
    setSortBy('name');
    setSortOrder('asc');
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleAdjustClick = (item: InventoryItem) => {
    openModal('inventory_adjust', item);
  };

  const handleGlobalHistoryClick = () => {
    openModal('inventory_history', { productId: undefined, productName: undefined });
  };

  return (
    <PageContainer
      title={t('inventory.title')}
      description={t('inventory.description')}
      loading={false} // InventoryTable renders its own skeleton in-place
      error={!isLoadingInventory ? (error as Error) : null}
      refetch={refetch}
      actions={
        <>
          <Link to="/purchases" className="text-sm text-primary underline">
            {t('nav.purchases')}
          </Link>
          <Link to="/products" className="text-sm text-primary underline">
            {t('nav.products')}
          </Link>
          <button
            onClick={handleGlobalHistoryClick}
            className="flex items-center gap-2 px-4 py-2 h-10 bg-white dark:bg-card border border-border/60 hover:border-primary/40 rounded-xl font-bold text-xs uppercase tracking-wider text-secondary hover:text-primary transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <History size={16} />
            <span>{t('inventory.globalHistory')}</span>
          </button>
        </>
      }
    >
      {/* Search inputs and toggles decomposed filter bar */}
      <InventoryFilterBar
        categories={categories}
        isLoadingCategories={isLoadingCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(catId) => {
          setSelectedCategoryId(catId);
          setPage(1);
        }}
        debouncedSearch={debouncedSearch}
        onSearchChange={(search) => {
          setDebouncedSearch(search);
          setPage(1);
        }}
        showLowStock={showLowStock}
        onToggleLowStock={() => {
          setShowLowStock(!showLowStock);
          setPage(1);
        }}
        onClearFilters={handleClearFilters}
      />

      {/* Tabs */}
      <div className="flex space-x-6 mb-6 border-b border-border/40 mt-4 px-2">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 flex items-center space-x-2 font-bold uppercase tracking-wider text-xs border-b-2 transition-all duration-300 ${
            activeTab === 'stock'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>{t('inventory.stockLevels')}</span>
        </button>
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 flex items-center space-x-2 font-bold uppercase tracking-wider text-xs border-b-2 transition-all duration-300 ${
            activeTab === 'batches'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Batches & Expiry (FEFO)</span>
        </button>
        <button
          onClick={() => setActiveTab('cycle_counts')}
          className={`pb-3 flex items-center space-x-2 font-bold uppercase tracking-wider text-xs border-b-2 transition-all duration-300 ${
            activeTab === 'cycle_counts'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-foreground'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>{t('inventory.cycleCountsTab')}</span>
        </button>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Main Stock Inventory Table */}
          <InventoryTable
            items={items}
            onAdjust={handleAdjustClick}
            isLoading={isLoadingInventory && page === 1}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          {/* Unified Pagination footer component */}
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            itemName="listings"
          />
        </>
      ) : activeTab === 'batches' ? (
        <ProductBatchList />
      ) : (
        <CycleCountBatchList />
      )}

      {/* Centralized modal containers */}
      <InventoryAdjustmentModal />
      <AdjustmentHistoryViewer />
    </PageContainer>
  );
}
export default InventoryPage;
