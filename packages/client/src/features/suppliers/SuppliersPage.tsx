import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useSuppliers, useDeleteSupplier, type Supplier } from './hooks/useSupplierQueries';
import { SupplierFormModal } from './components/SupplierFormModal';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/hooks/useTranslation';

export function SuppliersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Soft delete safety modal states
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const { data, isLoading, error, refetch } = useSuppliers(search, page, limit);
  const deleteSupplier = useDeleteSupplier();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  const items = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleCreate = () => {
    setSelectedSupplier(null);
    setIsFormOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
  };

  const confirmDelete = () => {
    if (supplierToDelete) {
      deleteSupplier.mutate(supplierToDelete.id, {
        onSuccess: () => {
          setSupplierToDelete(null);
        },
      });
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1); // Reset to page 1 on search
  };

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  // Derived totals for the active list page
  const pageActiveCount = items.filter((s) => s.status === 'active').length;
  const pageInactiveCount = items.filter((s) => s.status === 'inactive').length;
  const pageSuspendedCount = items.filter((s) => s.status === 'suspended').length;

  const { t } = useTranslation();

  return (
    <PageContainer
      title={t('suppliers.title')}
      description={t('suppliers.description')}
      loading={isLoading && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        <Button
          onClick={handleCreate}
          className="flex items-center space-x-1.5 font-semibold bg-success hover:bg-success/90 text-white"
        >
          <Plus size={16} />
          <span>{t('suppliers.registerSupplier')}</span>
        </Button>
      }
    >
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Total Registered */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('suppliers.totalSuppliers')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-foreground">{meta.total}</span>
            <span className="text-xs text-neutral-500">{t('suppliers.registeredProfiles')}</span>
          </div>
        </div>

        {/* Card 2: Catalog Integration */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('suppliers.catalogCoverage')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-success">
              {items.reduce((sum, item) => sum + (item.active_catalog_count || 0), 0)}
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              {t('suppliers.assignedProducts')}
            </span>
          </div>
        </div>

        {/* Card 3: Status Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {t('suppliers.directoryHealth')}
          </span>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="flex items-center text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success/90 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                {pageActiveCount} {t('suppliers.active')}
              </span>
              <span className="flex items-center text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                {pageInactiveCount} {t('suppliers.inactive')}
              </span>
              <span className="flex items-center text-danger">
                <span className="h-1.5 w-1.5 rounded-full bg-danger mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                {pageSuspendedCount} {t('suppliers.suspended')}
              </span>
            </div>
            <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-card-hover text-secondary border border-border">
              {t('suppliers.erpStates')}
            </span>
          </div>
        </div>
      </div>

      {/* Filter / Search section */}
      <div className="flex items-center rounded-lg border border-border bg-card/40 p-4 mb-6">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('suppliers.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-input py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-neutral-500 focus:border-success focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-border bg-card/20 overflow-hidden">
        {isLoading && page > 1 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-success/20 border-t-emerald-500" />
            <span className="mt-3 text-sm text-secondary font-mono">{t('common.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-secondary mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {t('suppliers.noSuppliers')}
            </h3>
            <p className="text-sm text-secondary mt-1 max-w-sm mx-auto">
              {t('suppliers.noSuppliersDesc')}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="w-full text-left rtl:text-right border-collapse">
              <thead>
                <tr className="table-header-sticky border-b border-border bg-card/90 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-secondary">
                  <th className="px-6 py-4">{t('suppliers.code')}</th>
                  <th className="px-6 py-4">{t('purchases.supplier')}</th>
                  <th className="px-6 py-4">{t('suppliers.representative')}</th>
                  <th className="px-6 py-4">{t('customers.phone')}</th>
                  <th className="px-6 py-4">{t('suppliers.email')}</th>
                  <th className="px-6 py-4">{t('common.status')}</th>
                  <th className="px-6 py-4 text-center">{t('suppliers.catalogProducts')}</th>
                  <th className="px-6 py-4 text-right rtl:text-left">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((supplier) => (
                  <tr key={supplier.id} className="table-row-hover hover:bg-card-hover/40 transition-colors group">
                    {/* Code */}
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-secondary">
                      {supplier.supplier_code}
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4 font-semibold text-foreground">
                      <button
                        onClick={() => navigate(`/suppliers/${supplier.id}`)}
                        className="hover:underline text-left rtl:text-right font-semibold text-foreground hover:text-success focus:outline-none transition-colors"
                      >
                        {supplier.name}
                      </button>
                    </td>

                    {/* Contact Person */}
                    <td className="px-6 py-4 text-sm text-foreground">
                      {supplier.contact_name || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-sm font-mono text-secondary">
                      {supplier.phone || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-secondary font-mono">
                      {supplier.email || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 text-sm">
                      {supplier.status === 'active' ? (
                        <span className="inline-flex items-center rounded-md bg-success/90/10 border border-success/20 px-2 py-1 text-xs font-medium text-success dark:text-success">
                          <CheckCircle2 size={12} className="mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                          {t('suppliers.active')}
                        </span>
                      ) : supplier.status === 'inactive' ? (
                        <span className="inline-flex items-center rounded-md bg-warning/10 border border-warning/20 px-2 py-1 text-xs font-medium text-warning dark:text-warning">
                          <AlertTriangle size={12} className="mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                          {t('suppliers.inactive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-danger/10 border border-danger/20 px-2 py-1 text-xs font-medium text-danger dark:text-danger">
                          <ShieldAlert size={12} className="mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                          {t('suppliers.suspended')}
                        </span>
                      )}
                    </td>

                    {/* Catalog Products */}
                    <td className="px-6 py-4 text-sm text-center font-semibold text-foreground">
                      <span className="inline-block px-2.5 py-0.5 rounded bg-card border border-border text-foreground font-mono">
                        {supplier.active_catalog_count}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm text-right rtl:text-left">
                      <div className="flex gap-2 justify-end rtl:justify-start">
                        <Button
                          onClick={() => navigate(`/suppliers/${supplier.id}`)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          <Eye size={12} className="mr-1 rtl:ml-1 rtl:mr-0" />
                          {t('customers.details')}
                        </Button>
                        <Button
                          onClick={() => handleEdit(supplier)}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          <Edit2 size={12} className="mr-1 rtl:ml-1 rtl:mr-0" />
                          {t('common.edit')}
                        </Button>
                        {isAdminOrManager && (
                          <Button
                            onClick={() => handleDeleteClick(supplier)}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                          >
                            <Trash2 size={12} className="mr-1 rtl:ml-1 rtl:mr-0" />
                            {t('common.delete')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {meta.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            itemName="suppliers"
          />
        </div>
      )}

      {/* Form Modal Dialog */}
      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
      />

      {/* Deletion Warning & Safety Modal */}
      {supplierToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-6 text-foreground">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2 text-destructive border border-destructive/20 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-2 flex-1 text-left rtl:text-right">
                  <h3 className="text-lg font-semibold tracking-wide text-foreground">
                    {t('common.confirm')}
                  </h3>
                  <p className="text-sm text-secondary leading-relaxed">
                    {t('suppliers.deleteConfirmDesc')
                      .replace('{name}', supplierToDelete.name)
                      .replace('{code}', supplierToDelete.supplier_code)}
                  </p>

                  {supplierToDelete.active_catalog_count > 0 && (
                    <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-xs text-warning dark:text-warning leading-relaxed">
                      <span className="font-semibold block mb-1">
                        {t('suppliers.activeCatalogWarningTitle')}
                      </span>
                      {t('suppliers.activeCatalogWarningDesc').replace(
                        '{count}',
                        String(supplierToDelete.active_catalog_count),
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4 mt-6">
                <Button
                  onClick={() => setSupplierToDelete(null)}
                  disabled={deleteSupplier.isPending}
                  variant="outline"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={deleteSupplier.isPending}
                  className="bg-danger/90 px-4 py-2 text-sm font-semibold text-white hover:bg-danger disabled:opacity-50 transition-colors shadow-lg shadow-danger/10"
                >
                  {deleteSupplier.isPending ? t('common.loading') : t('common.delete')}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </PageContainer>
  );
}

export default SuppliersPage;
