import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePurchaseOrder,
  usePlacePurchaseOrder,
  useCancelPurchaseOrder,
  usePurchaseReceipts,
} from './hooks/usePurchaseQueries';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GoodsReceiptModal } from './components/GoodsReceiptModal';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft, Calendar, User, FileText, Truck, CheckCircle2, XCircle, History } from 'lucide-react';

export function PurchaseOrderDetailScreen() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(idParam);
  const { t, language } = useTranslation();

  const { data: poResponse, isLoading, error } = usePurchaseOrder(id);
  const po = poResponse?.data;
  
  const { data: receiptsResponse } = usePurchaseReceipts(id);
  const receipts = receiptsResponse?.data || [];

  const placeOrder = usePlacePurchaseOrder();
  const cancelOrder = useCancelPurchaseOrder();
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const isManagerOrAdmin = ['admin', 'manager'].includes(currentUserRole || '');

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const handlePlaceOrder = () => {
    if (window.confirm(t('purchases.confirmPlace'))) {
      placeOrder.mutate(id);
    }
  };

  const handleCancelOrder = () => {
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
      case 'partially_received':
        return (
          <Badge
            variant="warning"
            className="bg-warning/15 text-warning border-warning/30 uppercase"
          >
            Partially Received
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

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center font-sans text-foreground">
        <Spinner size="md" />
        <span className="mt-3 text-sm text-secondary font-mono">
          {t('purchases.loadingDetails')}
        </span>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="text-center py-12 font-sans text-foreground">
        <h3 className="text-lg font-semibold text-danger">{t('purchases.notFound')}</h3>
        <p className="text-sm text-neutral-500 mt-2">{t('purchases.notFoundDesc')}</p>
        <Button onClick={() => navigate('/purchases')} variant="secondary" className="mt-6">
          {t('purchases.backToControl')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-foreground p-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/purchases')}
            variant="outline"
            size="icon"
            className="rtl:rotate-180"
            title={t('purchases.backToOverview')}
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {po.po_number}
              </h1>
              {getStatusBadge(po.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-secondary font-mono">
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-secondary" />
                <span>
                  {t('purchases.created')}: {formatDate(po.created_at)}
                </span>
              </span>
              {po.delivery_date && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  <span className="flex items-center gap-1">
                    <Truck size={13} className="text-secondary" />
                    <span>
                      {t('purchases.receivedDate')}: {formatDate(po.delivery_date)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        {isManagerOrAdmin && (
          <div className="flex items-center gap-2">
            {po.status === 'draft' && (
              <>
                <Button
                  onClick={handleCancelOrder}
                  disabled={cancelOrder.isPending}
                  variant="outline"
                  className="text-danger hover:text-danger hover:bg-danger/10 border-border gap-1.5"
                >
                  <XCircle size={14} />
                  {t('purchases.cancelDraft')}
                </Button>
                <Button
                  onClick={handlePlaceOrder}
                  disabled={placeOrder.isPending}
                  className="bg-warning/90 hover:bg-warning text-white font-semibold"
                >
                  {t('purchases.placeOrder')}
                </Button>
              </>
            )}
            {(po.status === 'ordered' || po.status === 'partially_received') && (
              <>
                <Button
                  onClick={handleCancelOrder}
                  disabled={cancelOrder.isPending}
                  variant="outline"
                  className="text-danger hover:text-danger hover:bg-danger/10 border-border gap-1.5"
                >
                  <XCircle size={14} />
                  {t('purchases.cancelOrder')}
                </Button>
                <Button
                  onClick={() => setIsReceiptOpen(true)}
                  className="bg-success hover:bg-success/90 text-white font-bold gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  {po.status === 'ordered' ? t('purchases.receiveInflux') : 'Continue Receiving'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Supplier and Audit Details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Supplier Info Profile */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-border pb-2">
              {t('purchases.supplierOverview')}
            </h3>
            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-xs text-secondary uppercase font-bold block mb-0.5">
                  {t('purchases.supplierName')}
                </span>
                <span className="font-semibold text-foreground">{po.supplier_name}</span>
              </div>
              <div>
                <span className="text-xs text-secondary uppercase font-bold block mb-0.5">
                  {t('purchases.supplierCode')}
                </span>
                <span className="font-mono text-foreground font-bold">{po.supplier_code}</span>
              </div>
            </div>
          </div>

          {/* Logistics & Registry Audit Trail */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-border pb-2 flex items-center justify-between">
              <span>{t('purchases.ledgerMetadata')}</span>
              <User size={14} className="text-secondary" />
            </h3>
            <div className="space-y-3.5 text-sm font-sans">
              <div>
                <span className="text-xs text-secondary uppercase font-bold block mb-0.5">
                  {t('purchases.issuedBy')}
                </span>
                <span className="text-foreground">{po.creator_name || 'N/A'}</span>
              </div>
              {po.status === 'received' && (
                <div>
                  <span className="text-xs text-secondary uppercase font-bold block mb-0.5">
                    {t('purchases.receivedBy')}
                  </span>
                  <span className="text-foreground">{po.receiver_name || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Notes */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary border-b border-border pb-2 flex items-center gap-1.5">
              <FileText size={13} className="text-secondary" />
              <span>{t('purchases.logisticsNotes')}</span>
            </h3>
            <p className="text-secondary italic bg-input/50 p-3 rounded-lg border border-border text-xs leading-relaxed max-w-full break-words">
              {po.notes || t('purchases.noNotes')}
            </p>
          </div>
        </div>

        {/* Right Side: Financial Recaps & Items Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Breakdown Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-border bg-card/40">
            <div className="space-y-1">
              <span className="text-xs text-secondary uppercase font-bold block">
                {t('pos.subtotal')}
              </span>
              <span className="text-base font-mono font-bold text-foreground">
                {formatCurrency(po.subtotal)}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-secondary uppercase font-bold block">
                {t('pos.discount')}
              </span>
              <span className="text-base font-mono font-bold text-danger">
                -{formatCurrency(po.discount_amount)}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-secondary uppercase font-bold block">
                {t('pos.tax')}
              </span>
              <span className="text-base font-mono font-bold text-foreground">
                {formatCurrency(po.tax_amount)}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-success uppercase font-bold block">
                {t('purchases.grandTotal')}
              </span>
              <span className="text-lg font-mono font-extrabold text-success">
                {formatCurrency(po.total)}
              </span>
            </div>
          </div>

          {/* Items Order List Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-input px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t('purchases.lineItems')}</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-input border border-border text-secondary">
                {po.items?.length || 0} {t('pos.items')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-input/40 text-secondary font-semibold">
                    <th className="py-3 px-4 text-start">{t('purchases.product')}</th>
                    <th className="py-3 px-4 text-center">{t('products.barcode')}</th>
                    <th className="py-3 px-4 text-center">{t('purchases.orderedQty')}</th>
                    {po.status !== 'draft' && po.status !== 'ordered' && (
                      <>
                        <th className="py-3 px-4 text-center">{t('purchases.receivedQty')}</th>
                        <th className="py-3 px-4 text-center text-warning">Shortage</th>
                      </>
                    )}
                    <th className="py-3 px-4 text-center">{t('purchases.unit')}</th>
                    <th className="py-3 px-4 text-end">{t('purchases.unitCost')}</th>
                    <th className="py-3 px-4 text-end">{t('purchases.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans text-foreground">
                  {po.items?.map((item, idx) => {
                    const resolved = (item.received_quantity || 0) + (item.shortage_quantity || 0);
                    const remaining = Math.max(0, item.ordered_quantity - resolved);
                    return (
                    <tr key={item.id || idx} className="hover:bg-card-hover/10 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{item.product_name}</div>
                        {item.product_name_ar && (
                          <div className="text-xs text-secondary font-normal dir-rtl mt-0.5">
                            {item.product_name_ar}
                          </div>
                        )}
                        {po.status !== 'draft' && remaining > 0 && (
                          <div className="text-xs text-warning font-mono mt-1">
                            Pending: {remaining}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-secondary">
                        {item.barcode || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-foreground">
                        {item.ordered_quantity}
                      </td>
                      {po.status !== 'draft' && po.status !== 'ordered' && (
                        <>
                          <td className="py-3 px-4 text-center font-mono font-bold text-success">
                            {item.received_quantity}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-warning">
                            {item.shortage_quantity}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-4 text-center text-secondary font-mono uppercase">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4 text-end font-mono text-foreground">
                        {formatCurrency(item.unit_cost)}
                      </td>
                      <td className="py-3 px-4 text-end font-mono font-bold text-foreground">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receiving History */}
          {receipts.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="border-b border-border bg-input px-5 py-3 flex items-center gap-2">
                <History size={16} className="text-secondary" />
                <h3 className="text-sm font-semibold text-foreground">Receiving History</h3>
              </div>
              <div className="p-5 space-y-6">
                {receipts.map((receipt) => (
                  <div key={receipt.id} className="border border-border rounded-lg p-4 bg-neutral-900/20">
                    <div className="flex justify-between items-start border-b border-border pb-3 mb-3">
                      <div>
                        <div className="font-mono text-sm font-bold text-foreground">{receipt.receipt_number}</div>
                        <div className="text-xs text-secondary mt-1">
                          {formatDate(receipt.created_at)} • Received by {receipt.receiver_name}
                        </div>
                      </div>
                      <Badge variant="outline" className="uppercase font-mono text-xs">
                        {receipt.status}
                      </Badge>
                    </div>
                    {receipt.notes && (
                      <div className="text-xs text-secondary italic mb-4 bg-neutral-900/40 p-2 rounded">
                        Notes: {receipt.notes}
                      </div>
                    )}
                    <table className="w-full text-left text-xs">
                       <thead>
                         <tr className="text-secondary border-b border-border/50">
                           <th className="py-2">Product</th>
                           <th className="py-2 text-center">Received</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-border/30">
                         {receipt.items.map(ri => (
                           <tr key={ri.id}>
                             <td className="py-2 text-foreground font-semibold">{ri.product_name}</td>
                             <td className="py-2 text-center font-mono text-success font-bold">{ri.quantity_received}</td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {isReceiptOpen && po && (
        <GoodsReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          purchaseOrder={po}
        />
      )}
    </div>
  );
}

export default PurchaseOrderDetailScreen;
