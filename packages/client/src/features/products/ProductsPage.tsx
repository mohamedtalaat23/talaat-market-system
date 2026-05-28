import { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { useProducts, useCategories, type Product } from './hooks/useProductQueries';
import { ProductModal } from './components/ProductModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { ProductFilterBar } from './components/ProductFilterBar';
import { ProductTable } from './components/ProductTable';
import { Pagination } from '@/components/ui/Pagination';
import { useModalStore } from '@/stores/modalStore';

/**
 * Product Catalog orchestrator page.
 * Keeps feature layout clean, delegating logic to dedicated sub-components.
 */
export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const openModal = useModalStore((state) => state.openModal);

  // Fetch dynamic categories and products list via custom hooks
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();

  // Memoize filters to stabilize reference and prevent infinite render loops
  const queryFilters = useMemo(() => ({
    page,
    limit,
    search: debouncedSearch,
    category_id: selectedCategoryId,
  }), [page, limit, debouncedSearch, selectedCategoryId]);

  const { data: productsData, isLoading: isLoadingProducts, error, refetch } = useProducts(queryFilters);

  const products = productsData?.data || [];
  const meta = productsData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleClearFilters = () => {
    setDebouncedSearch('');
    setSelectedCategoryId(null);
    setPage(1);
  };

  const handleSelectCategory = (catId: number | null) => {
    setSelectedCategoryId(catId);
    setPage(1);
  };

  const handleSearchChange = (searchTerm: string) => {
    setDebouncedSearch(searchTerm);
    setPage(1);
  };

  const openCreateModal = () => {
    openModal('product_form', { mode: 'create', product: undefined });
  };

  const openEditModal = (product: Product) => {
    openModal('product_form', { mode: 'edit', product });
  };

  const openDeleteDialog = (product: Product) => {
    openModal('product_delete', product);
  };

  return (
    <PageContainer
      title="Product Catalog"
      description="Add, search, and update standard supermarket stock items and scale-connected products."
      loading={isLoadingProducts && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        <Button onClick={openCreateModal} className="flex items-center space-x-1.5 font-semibold">
          <Plus size={16} />
          <span>Add Product</span>
        </Button>
      }
    >
      {/* Search and category filter subcomponent */}
      <ProductFilterBar
        categories={categories}
        isLoadingCategories={isLoadingCategories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        debouncedSearch={debouncedSearch}
        onSearchChange={handleSearchChange}
        onClearFilters={handleClearFilters}
      />

      {/* Product listing table subcomponent */}
      <ProductTable
        products={products}
        isLoading={isLoadingProducts && page > 1}
        onEdit={openEditModal}
        onDelete={openDeleteDialog}
        onClearFilters={handleClearFilters}
        hasFilters={Boolean(debouncedSearch || selectedCategoryId !== null)}
      />

      {/* Unified Pagination footer component */}
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
        itemName="products"
      />

      {/* Decoupled modals linked to Zustand useModalStore */}
      <ProductModal />
      <DeleteConfirmDialog />
    </PageContainer>
  );
}
export default ProductsPage;
