import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSupplierDetail, useDeleteSupplier } from '../hooks/useSupplierQueries';
import { SupplierFormModal } from '../components/SupplierFormModal';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Archive,
} from 'lucide-react';

export function SupplierDetailScreen() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(idParam);

  const { data: supplier, isLoading, error, refetch } = useSupplierDetail(id);
  const deleteSupplier = useDeleteSupplier();
  const currentUserRole = useAuthStore((state) => state.user?.role);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (supplier) {
      deleteSupplier.mutate(supplier.id, {
        onSuccess: () => {
          setIsDeleteOpen(false);
          navigate('/suppliers');
        },
      });
    }
  };

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole || '');

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center font-sans text-input-text">
        <Spinner size="md" />
        <span className="mt-3 text-sm text-secondary font-mono">
          Loading supplier profile & catalog...
        </span>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="text-center py-12 font-sans text-input-text">
        <h3 className="text-lg font-semibold text-danger">Supplier Profile Not Found</h3>
        <p className="text-sm text-neutral-500 mt-2">
          The requested supplier directory profile does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate('/suppliers')}
          className="mt-6 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold hover:bg-card-hover hover:text-input-text transition-colors"
        >
          Back to Suppliers Directory
        </button>
      </div>
    );
  }

  // Calculate live low stock count inside supplier catalog
  const catalog = supplier.catalog || [];
  const lowStockItems = catalog.filter(
    (product) => product.inventory_quantity <= product.min_stock_level,
  );

  return (
    <div className="space-y-6 font-sans text-input-text p-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-input-border pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/suppliers')}
            className="rounded-lg p-1.5 text-secondary hover:bg-card-hover hover:text-input-text transition-colors border border-input-border"
            title="Back to Directory"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-input-text">{supplier.name}</h1>
            <div className="flex items-center space-x-2.5 mt-1">
              <span className="text-xs font-mono text-neutral-500">
                Supplier: {supplier.supplier_code}
              </span>
              <span className="h-1 w-1 rounded-full bg-neutral-700" />
              {supplier.status === 'active' ? (
                <span className="inline-flex items-center text-xs font-semibold text-success">
                  <CheckCircle2 size={11} className="mr-1" /> Active
                </span>
              ) : supplier.status === 'inactive' ? (
                <span className="inline-flex items-center text-xs font-semibold text-warning">
                  <AlertTriangle size={11} className="mr-1" /> Inactive
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-semibold text-danger">
                  <ShieldAlert size={11} className="mr-1" /> Suspended
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-neutral-100 hover:bg-neutral-750 px-4 py-2.5 text-sm font-semibold hover:text-input-text transition-colors border border-neutral-750"
          >
            <Edit2 size={14} className="mr-1.5" />
            Edit Profile
          </button>
          {isAdminOrManager && (
            <button
              onClick={handleDeleteClick}
              className="inline-flex items-center justify-center rounded-lg bg-danger/15 text-danger hover:bg-danger/15 hover:text-danger px-4 py-2.5 text-sm font-semibold transition-colors border border-danger/20"
            >
              <Trash2 size={14} className="mr-1.5" />
              Delete Supplier
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Contact Information Summary */}
        <div className="space-y-6">
          {/* Supplier Stats summary */}
          <div className="rounded-xl border border-input-border bg-white p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-input-border pb-2 flex items-center justify-between">
              <span>Integration Status</span>
              <Archive size={14} className="text-neutral-500" />
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Catalog Products
                </span>
                <span className="text-xl font-bold font-mono text-input-text">
                  {catalog.length}
                </span>
              </div>
              <div>
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Low Stock Alerts
                </span>
                <span
                  className={`text-xl font-bold font-mono ${lowStockItems.length > 0 ? 'text-warning' : 'text-secondary'}`}
                >
                  {lowStockItems.length}
                </span>
              </div>
            </div>
            {supplier.status === 'inactive' && (
              <div className="rounded-lg border border-warning/30 bg-warning/15 p-2.5 text-xs text-warning flex items-start space-x-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>
                  Supplier is marked inactive. Warnings will display if active products are chosen.
                </span>
              </div>
            )}
            {supplier.status === 'suspended' && (
              <div className="rounded-lg border border-danger/20 bg-danger/15 p-2.5 text-xs text-danger flex items-start space-x-2">
                <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                <span>
                  Supplier is suspended. Newly created products cannot be assigned to this supplier.
                </span>
              </div>
            )}
          </div>

          {/* Contact profile card */}
          <div className="rounded-xl border border-input-border bg-white p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-input-border pb-2">
              Contact Profile
            </h3>
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Representative Name
                </span>
                <div className="font-semibold text-input-text">
                  {supplier.contact_name || (
                    <span className="text-neutral-600 font-normal italic">Not Specified</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Phone Number
                </span>
                <div className="font-semibold font-mono text-input-text flex items-center space-x-1.5">
                  <Phone size={13} className="text-neutral-500" />
                  <span>
                    {supplier.phone || (
                      <span className="text-neutral-600 font-normal italic font-sans">
                        Not Specified
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Email Address
                </span>
                <div
                  className="font-semibold font-mono text-input-text flex items-center space-x-1.5 truncate"
                  title={supplier.email || ''}
                >
                  <Mail size={13} className="text-neutral-500 animate-none shrink-0" />
                  <span className="truncate">
                    {supplier.email || (
                      <span className="text-neutral-600 font-normal italic font-sans">
                        Not Specified
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-neutral-500 uppercase font-bold block">
                  Office Address
                </span>
                <div className="font-semibold text-neutral-300 flex items-start space-x-1.5 leading-relaxed">
                  <MapPin size={13} className="text-neutral-500 mt-1 shrink-0" />
                  <span>
                    {supplier.address || (
                      <span className="text-neutral-600 font-normal italic">Not Specified</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Notes */}
          <div className="rounded-xl border border-input-border bg-white p-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-input-border pb-2 flex items-center space-x-1.5">
              <FileText size={13} className="text-neutral-500" />
              <span>Internal Procurement Notes</span>
            </h3>
            <div className="text-secondary italic bg-input-bg p-3 rounded-lg border border-input-border text-xs leading-relaxed max-w-full break-words">
              {supplier.notes ||
                'No custom procurement notes registered for this supplier profile.'}
            </div>
          </div>
        </div>

        {/* Right Side: Supplied Catalog Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-input-border bg-white overflow-hidden">
            <div className="border-b border-input-border bg-input-bg px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-input-text">Linked Catalog Products</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-850 border border-neutral-750 text-secondary">
                {catalog.length} Products
              </span>
            </div>

            {catalog.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-input-bg border border-input-border text-secondary mb-3">
                  <Archive size={18} />
                </div>
                <h4 className="text-sm font-semibold text-neutral-300">Catalog is Empty</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  No active supermarket catalog products are currently assigned to this supplier.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-input-border bg-input-bg/40 text-xs font-semibold uppercase tracking-wider text-secondary">
                      <th className="px-6 py-3.5">Barcode / Code</th>
                      <th className="px-6 py-3.5">Product Name</th>
                      <th className="px-6 py-3.5 text-right">Cost Price</th>
                      <th className="px-6 py-3.5 text-right">Selling Price</th>
                      <th className="px-6 py-3.5 text-center">Unit</th>
                      <th className="px-6 py-3.5 text-center">Live Stock Qty</th>
                      <th className="px-6 py-3.5 text-right">Stock Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 font-sans">
                    {catalog.map((product) => {
                      const isLowStock = product.inventory_quantity <= product.min_stock_level;

                      return (
                        <tr key={product.id} className="hover:bg-neutral-850/20 transition-colors">
                          {/* Barcode */}
                          <td className="px-6 py-4 text-xs font-mono text-secondary">
                            {product.barcode || (
                              <span className="text-neutral-600 font-sans italic">No Barcode</span>
                            )}
                          </td>

                          {/* Product Name */}
                          <td className="px-6 py-4 text-xs font-semibold text-input-text">
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              {product.name_ar && (
                                <span className="text-xs text-neutral-500 font-normal dir-rtl mt-0.5">
                                  {product.name_ar}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cost Price */}
                          <td className="px-6 py-4 text-xs font-mono text-right text-neutral-300">
                            {product.cost_price.toFixed(2)} EGP
                          </td>

                          {/* Selling Price */}
                          <td className="px-6 py-4 text-xs font-mono text-right text-input-text">
                            {product.selling_price.toFixed(2)} EGP
                          </td>

                          {/* Unit */}
                          <td className="px-6 py-4 text-xs text-center text-secondary">
                            {product.unit}
                          </td>

                          {/* Live Inventory Quantity */}
                          <td className="px-6 py-4 text-xs text-center font-mono">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded ${isLowStock ? 'text-warning bg-warning/15 border border-warning/30' : 'text-neutral-300 bg-neutral-850'}`}
                            >
                              {product.inventory_quantity}
                            </span>
                          </td>

                          {/* Stock Status Alert */}
                          <td className="px-6 py-4 text-xs text-right">
                            {isLowStock ? (
                              <span className="inline-flex items-center rounded bg-warning/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-warning border border-warning/30">
                                <AlertTriangle size={10} className="mr-1 shrink-0" />
                                Low Stock ({product.min_stock_level})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded bg-success/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-success border border-success/30">
                                Healthy
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Profile Form Modal */}
      <SupplierFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          refetch(); // Refetch details after edit
        }}
        supplier={supplier}
      />

      {/* Supplier Soft Deletion Safety Confirmation Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-input-border bg-input-bg shadow-2xl p-6 text-input-text">
            <div className="flex items-start space-x-3">
              <div className="rounded-full bg-danger/15 p-2 text-danger border border-danger/20">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold tracking-wide text-input-text">
                  Confirm Soft Deletion
                </h3>
                <p className="text-sm text-secondary leading-relaxed font-sans">
                  Are you sure you want to delete supplier{' '}
                  <span className="font-semibold text-input-text">"{supplier.name}"</span> (
                  {supplier.supplier_code})?
                </p>

                {catalog.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning/15 p-3 text-xs text-warning leading-relaxed font-sans">
                    <span className="font-semibold block mb-1">
                      ⚠️ Active Catalog Link Warning:
                    </span>
                    This supplier is currently linked to{' '}
                    <span className="font-semibold underline">
                      {catalog.length} active product(s)
                    </span>
                    . If you proceed, those products will remain in the catalog, but their primary
                    supplier connection will be set to{' '}
                    <span className="font-mono bg-input-bg px-1 rounded text-neutral-300">NULL</span>.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 border-t border-input-border pt-4 mt-6">
              <button
                onClick={() => setIsDeleteOpen(false)}
                disabled={deleteSupplier.isPending}
                className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold hover:bg-card-hover disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteSupplier.isPending}
                className="rounded-lg bg-danger/90 px-4 py-2 text-sm font-semibold text-white hover:bg-danger disabled:opacity-50 transition-colors shadow-lg shadow-danger/10"
              >
                {deleteSupplier.isPending ? 'Deleting...' : 'Proceed Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierDetailScreen;
