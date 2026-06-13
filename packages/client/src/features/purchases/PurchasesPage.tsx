import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import {
  usePurchaseOrders,
  usePlacePurchaseOrder,
  useCancelPurchaseOrder,
} from './hooks/usePurchaseQueries';
import { useSuppliers } from '../suppliers/hooks/useSupplierQueries';
import { PurchaseOrderFormModal } from './components/PurchaseOrderFormModal';
import { Plus, Eye, XCircle, ShoppingBag, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SortableHeader } from '@/components/ui/SortableHeader';

export function PurchasesPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
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
  queryFilters.sortBy = sortBy;
  queryFilters.sortOrder = sortOrder;

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
    if (window.confirm(t('purchases.confirmPlace'))) {
      placeOrder.mutate(id);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleCancelOrder = (id: number) => {
    if (window.confirm(t('purchases.confirmCancel'))) {
      cancelOrder.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Badge
            variant="secondary"
            className="bg-neutral-850 text-secondary border-border uppercase"
          >
            {t('purchases.draft')}
          </Badge>
        );
      case 'ordered':
        return (
          <Badge
            variant="warning"
            className="bg-warning/15 text-warning border-warning/30 uppercase"
          >
            {t('purchases.ordered')}
          </Badge>
        );
      case 'received':
        return (
          <Badge
            variant="success"
            className="bg-success/15 text-success border-success/30 uppercase"
          >
            {t('purchases.received')}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge
            variant="destructive"
            className="bg-danger/15 text-danger border-danger/30 uppercase"
          >
            {t('purchases.cancelled')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="uppercase">
            {status}
          </Badge>
        );
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <PageContainer
      title={t('purchases.title')}
      description={t('purchases.description')}
      loading={isLoading && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        isManagerOrAdmin ? (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-5 py-2.5 h-11 rounded-xl bg-gradient-to-r from-success to-emerald-500 hover:from-success/90 hover:to-emerald-400 text-white font-black text-sm uppercase tracking-wider transition-all shadow-[0_4px_14px_rgba(var(--color-success-500),0.3)] hover:shadow-[0_6px_20px_rgba(var(--color-success-500),0.4)] hover:-translate-y-0.5 active:scale-95 focus:outline-none focus:ring-2 focus:ring-success/20"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>{t('purchases.createPO')}</span>
          </button>
        ) : undefined
      }
    >
      {/* KPI Stats Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <div className="rounded-2xl border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t('purchases.totalPOs')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-black tracking-tighter text-foreground">{meta.total}</span>
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t('purchases.draftPOs')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-black tracking-tighter text-foreground">
              {items.filter((po) => po.status === 'draft').length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary bg-secondary/10 px-2 py-1 rounded-md">
              {t('purchases.awaitingReview')}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 space-y-3 group">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t('purchases.pendingDeliveries')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-black tracking-tighter text-warning group-hover:scale-105 transition-transform origin-left">
              {items.filter((po) => po.status === 'ordered').length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-warning bg-warning/10 px-2 py-1 rounded-md">
              {t('purchases.inTransit')}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 space-y-3 group">
          <span className="text-xs font-bold uppercase tracking-wider text-secondary">
            {t('purchases.receivedAudited')}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-black tracking-tighter text-success group-hover:scale-105 transition-transform origin-left">
              {items.filter((po) => po.status === 'received').length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-success bg-success/10 px-2 py-1 rounded-md">
              {t('purchases.stockSettled')}
            </span>
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-5 mb-6 rounded-2xl border border-border/40 bg-white/40 dark:bg-card/40 backdrop-blur-md shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
          {/* Supplier Filter */}
          <div className="flex flex-col space-y-1.5 w-full sm:w-64">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">{t('purchases.supplier')}</span>
            <select
              value={supplierFilter || ''}
              onChange={(e) => {
                setSupplierFilter(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="bg-background text-foreground border border-border/60 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-sm shadow-sm transition-all appearance-none cursor-pointer font-semibold"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
            >
              <option value="">{t('purchases.allSuppliers')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.supplier_code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col space-y-1.5 w-full sm:w-56">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              {t('purchases.orderStatus')}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-background text-foreground border border-border/60 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-sm shadow-sm transition-all appearance-none cursor-pointer font-semibold"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
            >
              <option value="">{t('employees.allStatuses')}</option>
              <option value="draft">{t('purchases.draft')}</option>
              <option value="ordered">{t('purchases.ordered')}</option>
              <option value="received">{t('purchases.received')}</option>
              <option value="cancelled">{t('purchases.cancelled')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid/Table */}
      <div className="rounded-2xl border border-border/40 bg-white/60 dark:bg-card/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="table-container">
          <table className="w-full text-start border-collapse text-sm">
            <thead>
              <tr className="table-header-sticky border-b border-border/50 bg-neutral-50/80 dark:bg-neutral-900/80 text-secondary font-bold uppercase tracking-wider text-[11px] select-none h-11">
                <th className="py-2 px-3 text-start">{t('purchases.poNumber')}</th>
                <SortableHeader
                  label={t('purchases.supplier')}
                  field="supplier"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="py-2 px-3"
                />
                <SortableHeader
                  label={t('purchases.orderDate')}
                  field="date"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="py-2 px-3"
                />
                <SortableHeader
                  label={t('common.status')}
                  field="status"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="py-2 px-3"
                />
                <SortableHeader
                  label={t('purchases.orderTotal')}
                  field="total"
                  align="end"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={handleSort}
                  className="py-2 px-3"
                />
                <th className="py-2 px-3 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                        <ShoppingBag className="h-8 w-8 text-neutral-400" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground mb-1">{t('purchases.noPOs')}</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((po) => (
                  <tr
                    key={po.id}
                    className="table-row-hover hover:bg-primary/5 text-foreground group h-14"
                  >
                    <td className="py-2 px-3 font-mono tabular-nums font-black text-primary text-[13px]">{po.po_number}</td>
                    <td className="py-2 px-3">
                      <div className="font-bold truncate max-w-[200px]" title={po.supplier_name}>{po.supplier_name}</div>
                      <div className="text-[11px] text-secondary font-mono tracking-widest">{po.supplier_code}</div>
                    </td>
                    <td className="py-2 px-3 text-xs font-mono font-semibold text-secondary tracking-wide">
                      {formatDate(po.order_date)}
                    </td>
                    <td className="py-2 px-3">{getStatusBadge(po.status)}</td>
                    <td className="py-2 px-3 text-end font-mono tabular-nums font-black text-foreground text-[13px]">
                      {formatCurrency(po.total)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/purchases/${po.id}`)}
                          className="h-8 px-3 bg-white dark:bg-card hover:bg-primary/10 text-secondary hover:text-primary text-[10px] font-black uppercase tracking-widest border border-border/60 hover:border-primary/40 rounded-lg transition-all duration-300 flex items-center gap-1.5 focus:outline-none hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                        >
                          <Eye size={12} />
                          <span>{t('purchases.view')}</span>
                        </button>
                        {isManagerOrAdmin && po.status === 'draft' && (
                          <button
                            onClick={() => handlePlaceOrder(po.id)}
                            className="h-8 px-3 bg-gradient-to-r from-warning to-yellow-500 hover:from-warning/90 hover:to-yellow-400 text-white text-[10px] font-black uppercase tracking-widest border border-transparent rounded-lg transition-all duration-300 flex items-center focus:outline-none hover:-translate-y-0.5 shadow-sm hover:shadow-md shadow-warning/20"
                          >
                            {t('purchases.placeOrder')}
                          </button>
                        )}
                        {isManagerOrAdmin && ['draft', 'ordered'].includes(po.status) && (
                          <button
                            onClick={() => handleCancelOrder(po.id)}
                            className="h-8 px-2.5 bg-white dark:bg-card hover:bg-danger/10 text-secondary hover:text-danger border border-border/60 hover:border-danger/40 rounded-lg transition-all duration-300 flex items-center focus:outline-none hover:-translate-y-0.5 shadow-sm hover:shadow-md"
                            title={t('purchases.cancel')}
                          >
                            <XCircle size={14} />
                          </button>
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
          itemName={language === 'ar' ? 'طلبات الشراء' : 'purchase orders'}
        />
      </div>

      {isFormOpen && (
        <PurchaseOrderFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />
      )}
    </PageContainer>
  );
}
