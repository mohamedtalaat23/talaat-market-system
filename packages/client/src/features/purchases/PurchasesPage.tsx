import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { usePurchaseOrders, usePlacePurchaseOrder, useCancelPurchaseOrder } from './hooks/usePurchaseQueries';
import { useSuppliers } from '../suppliers/hooks/useSupplierQueries';
import { PurchaseOrderFormModal } from './components/PurchaseOrderFormModal';
import { Plus, Eye, XCircle, ShoppingBag, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function PurchasesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [isFormOpen, setIsFormOpen] = useState(false);

  // Construct filters dynamically to respect exactOptionalPropertyTypes
  const queryFilters: any = { page, limit };
  if (statusFilter) {
    queryFilters.status = statusFilter;
  }
  if (supplierFilter) {
    queryFilters.supplier_id = supplierFilter;
  }

  // Fetch paginated purchase orders
  const { data, isLoading, error, refetch } = usePurchaseOrders(queryFilters);

  // Fetch suppliers for filters (get up to 100 active suppliers)
  const { data: suppliersData } = useSuppliers('', 1, 100);
  const suppliers = suppliersData?.items || [];

  const placeOrder = usePlacePurchaseOrder();
  const cancelOrder = useCancelPurchaseOrder();
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const isManagerOrAdmin = ['admin', 'manager'].includes(currentUserRole || '');

  const items = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const handleCreate = () => {
    setIsFormOpen(true);
  };

  const handlePlaceOrder = (id: number) => {
    if (window.confirm('Are you sure you want to officially place this purchase order?')) {
      placeOrder.mutate(id);
    }
  };

  const handleCancelOrder = (id: number) => {
    if (window.confirm('Are you sure you want to cancel this purchase order? This action is permanent.')) {
      cancelOrder.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-neutral-800 text-neutral-300 border-border uppercase">Draft</Badge>;
      case 'ordered':
        return <Badge variant="warning" className="bg-amber-950/40 text-amber-400 border-amber-800/50 uppercase">Ordered</Badge>;
      case 'received':
        return <Badge variant="success" className="bg-emerald-950/40 text-emerald-400 border-emerald-800/50 uppercase">Received</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="bg-rose-950/40 text-rose-400 border-rose-800/50 uppercase">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="uppercase">{status}</Badge>;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PageContainer
      title="Purchases Control"
      description="Issue Purchase Orders to suppliers, verify inbound stock arrivals, and trace catalog unit costs."
      loading={isLoading && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        isManagerOrAdmin ? (
          <Button onClick={handleCreate} className="flex items-center space-x-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">
            <Plus size={16} />
            <span>Create Purchase Order</span>
          </Button>
        ) : undefined
      }
    >
      {/* KPI Stats Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Total Purchase Orders</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-neutral-100">{meta.total}</span>
            <FileText className="h-4 w-4 text-neutral-500" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Draft POs</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-neutral-300">
              {items.filter((po) => po.status === 'draft').length}
            </span>
            <span className="text-xs text-neutral-500 font-mono">Awaiting Review</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Pending Deliveries</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-amber-500">
              {items.filter((po) => po.status === 'ordered').length}
            </span>
            <span className="text-xs text-neutral-500 font-mono">In Transit</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-neutral-900/50 p-5 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">Received Audited</span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight text-emerald-500">
              {items.filter((po) => po.status === 'received').length}
            </span>
            <span className="text-xs text-neutral-500 font-mono">Stock Settled</span>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 mb-6 rounded-xl border border-border bg-neutral-900/20">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Supplier Filter */}
          <div className="flex flex-col space-y-1 w-full sm:w-56">
            <span className="text-xs font-semibold text-secondary">Supplier</span>
            <select
              value={supplierFilter || ''}
              onChange={(e) => {
                setSupplierFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="bg-neutral-900 text-neutral-200 border border-border rounded-lg py-1.5 px-3 focus:outline-none focus:border-primary text-sm"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.supplier_code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col space-y-1 w-full sm:w-44">
            <span className="text-xs font-semibold text-secondary">Order Status</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-neutral-900 text-neutral-200 border border-border rounded-lg py-1.5 px-3 focus:outline-none focus:border-primary text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid/Table */}
      <div className="rounded-xl border border-border bg-neutral-900/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-neutral-900/60 text-secondary font-semibold">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Order Total</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <ShoppingBag className="mx-auto h-8 w-8 text-neutral-600 mb-2" />
                    <span>No purchase orders found matching your search.</span>
                  </td>
                </tr>
              ) : (
                items.map((po) => (
                  <tr key={po.id} className="hover:bg-neutral-900/20 text-neutral-200 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">{po.po_number}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{po.supplier_name}</div>
                      <div className="text-xs text-neutral-500 font-mono">{po.supplier_code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-secondary">
                      {formatDate(po.order_date)}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(po.status)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-100">
                      {formatCurrency(po.total)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/purchases/${po.id}`)}
                          className="flex items-center space-x-1 text-secondary hover:text-white"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </Button>
                        {isManagerOrAdmin && po.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => handlePlaceOrder(po.id)}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                          >
                            Place Order
                          </Button>
                        )}
                        {isManagerOrAdmin && ['draft', 'ordered'].includes(po.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelOrder(po.id)}
                            className="text-rose-500 hover:text-rose-400 hover:bg-rose-950/20"
                          >
                            <XCircle size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={limit}
          onPageChange={(p) => setPage(p)}
          itemName="purchase orders"
        />
      </div>

      {isFormOpen && (
        <PurchaseOrderFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </PageContainer>
  );
}
