import { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { History } from 'lucide-react';
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

/**
 * Inventory Levels management orchestrator.
 * Delegates list filtration, pagination, and overlays to subcomponents.
 */
export function InventoryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
        <Button
          onClick={handleGlobalHistoryClick}
          variant="outline"
          className="flex items-center gap-1.5 font-semibold h-10"
        >
          <History size={16} />
          <span>{t('inventory.globalHistory')}</span>
        </Button>
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

      {/* Centralized modal containers */}
      <InventoryAdjustmentModal />
      <AdjustmentHistoryViewer />
    </PageContainer>
  );
}
export default InventoryPage;
