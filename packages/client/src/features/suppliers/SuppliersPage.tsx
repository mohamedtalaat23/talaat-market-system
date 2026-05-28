import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useSuppliers, useDeleteSupplier, type Supplier } from './hooks/useSupplierQueries';
import { SupplierFormModal } from './components/SupplierFormModal';
import { Plus, Search, Edit2, Trash2, Eye, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

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
  const pageActiveCount = items.filter(s => s.status === 'active').length;
  const pageInactiveCount = items.filter(s => s.status === 'inactive').length;
  const pageSuspendedCount = items.filter(s => s.status === 'suspended').length;

  return (
    <PageContainer
      title="Suppliers Management"
      description="Manage supplier profiles, contact details, status, and catalog distribution networks."
      loading={isLoading && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        <Button onClick={handleCreate} className="flex items-center space-x-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">
          <Plus size={16} />
          <span>Register Supplier</span>
        </Button>
      }
    >
      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Total Registered */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Total Suppliers</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-neutral-100">{meta.total}</span>
            <span className="text-xs text-neutral-500 font-mono">Registered Profiles</span>
          </div>
        </div>

        {/* Card 2: Catalog Integration */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Catalog Coverage</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-emerald-500">
              {items.reduce((sum, item) => sum + (item.active_catalog_count || 0), 0)}
            </span>
            <span className="text-xs text-neutral-500 font-mono">Assigned Products (Page)</span>
          </div>
        </div>

        {/* Card 3: Status Breakdown */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Directory Health (Page)</span>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5" />
                {pageActiveCount} Active
              </span>
              <span className="flex items-center text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
                {pageInactiveCount} Inactive
              </span>
              <span className="flex items-center text-rose-500">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5" />
                {pageSuspendedCount} Suspended
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
              ERP States
            </span>
          </div>
        </div>
      </div>

      {/* Filter / Search section */}
      <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 mb-6">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by code, name, contact, or phone..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/20 overflow-hidden">
        {isLoading && page > 1 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500" />
            <span className="mt-3 text-sm text-neutral-400 font-mono">Fetching suppliers list...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-semibold text-neutral-200">No Suppliers Found</h3>
            <p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search query or register a new supplier profile.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Supplier Name</th>
                  <th className="px-6 py-4">Representative</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Catalog Products</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {items.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-neutral-850/40 transition-colors group">
                    {/* Code */}
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-neutral-400">
                      {supplier.supplier_code}
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4 font-semibold text-neutral-100">
                      <button
                        onClick={() => navigate(`/suppliers/${supplier.id}`)}
                        className="hover:underline text-left font-semibold text-neutral-200 hover:text-emerald-400 focus:outline-none transition-colors"
                      >
                        {supplier.name}
                      </button>
                    </td>

                    {/* Contact Person */}
                    <td className="px-6 py-4 text-sm text-neutral-300">
                      {supplier.contact_name || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 text-sm font-mono text-neutral-400">
                      {supplier.phone || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-neutral-400 font-mono">
                      {supplier.email || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 text-sm">
                      {supplier.status === 'active' ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-950/40 border border-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-400">
                          <CheckCircle2 size={12} className="mr-1.5" />
                          Active
                        </span>
                      ) : supplier.status === 'inactive' ? (
                        <span className="inline-flex items-center rounded-md bg-amber-950/40 border border-amber-900/30 px-2 py-1 text-xs font-medium text-amber-400">
                          <AlertTriangle size={12} className="mr-1.5" />
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-rose-950/40 border border-rose-900/30 px-2 py-1 text-xs font-medium text-rose-400">
                          <ShieldAlert size={12} className="mr-1.5" />
                          Suspended
                        </span>
                      )}
                    </td>

                    {/* Catalog Products */}
                    <td className="px-6 py-4 text-sm text-center font-semibold text-neutral-300">
                      <span className="inline-block px-2.5 py-0.5 rounded bg-neutral-850 border border-neutral-750 text-neutral-300 font-mono">
                        {supplier.active_catalog_count}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => navigate(`/suppliers/${supplier.id}`)}
                        className="inline-flex items-center rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:text-neutral-100 transition-colors"
                      >
                        <Eye size={12} className="mr-1" />
                        Details
                      </button>
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="inline-flex items-center rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 hover:text-neutral-100 transition-colors"
                      >
                        <Edit2 size={12} className="mr-1" />
                        Edit
                      </button>
                      {isAdminOrManager && (
                        <button
                          onClick={() => handleDeleteClick(supplier)}
                          className="inline-flex items-center rounded bg-rose-950/40 text-rose-400 hover:bg-rose-900/40 hover:text-rose-300 border border-rose-900/30 px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <Trash2 size={12} className="mr-1" />
                          Delete
                        </button>
                      )}
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
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-xl border border-rose-900/30 bg-neutral-900 shadow-2xl p-6 text-neutral-100 border border-neutral-850">
            <div className="flex items-start space-x-3">
              <div className="rounded-full bg-rose-950/50 p-2 text-rose-500 border border-rose-900/30">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-wide text-neutral-200">Confirm Soft Deletion</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Are you sure you want to delete supplier <span className="font-semibold text-neutral-100">"{supplierToDelete.name}"</span> ({supplierToDelete.supplier_code})?
                </p>

                {supplierToDelete.active_catalog_count > 0 && (
                  <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-300 leading-relaxed">
                    <span className="font-semibold block mb-1">⚠️ Active Catalog Link Warning:</span>
                    This supplier is currently linked to <span className="font-semibold underline">{supplierToDelete.active_catalog_count} active product(s)</span>.
                    If you proceed, those products will remain in the catalog, but their primary supplier connection will be set to <span className="font-mono bg-neutral-950 px-1 rounded text-neutral-300">NULL</span>.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-neutral-850 pt-4 mt-6">
              <button
                onClick={() => setSupplierToDelete(null)}
                disabled={deleteSupplier.isPending}
                className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteSupplier.isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition-colors shadow-lg shadow-rose-950/20"
              >
                {deleteSupplier.isPending ? 'Deleting...' : 'Proceed Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default SuppliersPage;
