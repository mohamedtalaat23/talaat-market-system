import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePurchaseOrder,
  usePlacePurchaseOrder,
  useCancelPurchaseOrder,
} from './hooks/usePurchaseQueries';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GoodsReceiptModal } from './components/GoodsReceiptModal';
import {
  ArrowLeft,
  Calendar,
  User,
  FileText,
  Truck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export function PurchaseOrderDetailScreen() {
  const { id: idParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = Number(idParam);

  const { data: poResponse, isLoading, error } = usePurchaseOrder(id);
  const po = poResponse?.data;

  const placeOrder = usePlacePurchaseOrder();
  const cancelOrder = useCancelPurchaseOrder();
  const currentUserRole = useAuthStore((state) => state.user?.role);
  const isManagerOrAdmin = ['admin', 'manager'].includes(currentUserRole || '');

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const handlePlaceOrder = () => {
    if (window.confirm('Are you sure you want to officially place this purchase order?')) {
      placeOrder.mutate(id);
    }
  };

  const handleCancelOrder = () => {
    if (window.confirm('Are you sure you want to cancel this purchase order? This action is permanent.')) {
      cancelOrder.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-neutral-800 text-neutral-300 border-neutral-700 uppercase">Draft</Badge>;
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

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center font-sans text-neutral-100">
        <Spinner size="md" />
        <span className="mt-3 text-sm text-neutral-400 font-mono">Loading purchase order details...</span>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="text-center py-12 font-sans text-neutral-100">
        <h3 className="text-lg font-semibold text-rose-500">Purchase Order Not Found</h3>
        <p className="text-sm text-neutral-500 mt-2">
          The requested purchase order record does not exist or has been deleted.
        </p>
        <button
          onClick={() => navigate('/purchases')}
          className="mt-6 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
        >
          Back to Purchases Control
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-neutral-100 p-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-850 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/purchases')}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-850 hover:text-neutral-100 transition-colors border border-neutral-800 bg-neutral-900/30"
            title="Back to Overview"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-100 font-mono">
                {po.po_number}
              </h1>
              {getStatusBadge(po.status)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-neutral-400 font-mono">
              <span className="flex items-center space-x-1">
                <Calendar size={13} className="text-neutral-500" />
                <span>Created: {formatDate(po.created_at)}</span>
              </span>
              {po.delivery_date && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-800" />
                  <span className="flex items-center space-x-1">
                    <Truck size={13} className="text-neutral-500" />
                    <span>Received: {formatDate(po.delivery_date)}</span>
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
                  className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-rose-400 font-semibold"
                >
                  <XCircle size={14} className="mr-1.5" />
                  Cancel Draft
                </Button>
                <Button
                  onClick={handlePlaceOrder}
                  disabled={placeOrder.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                  Place Order
                </Button>
              </>
            )}
            {po.status === 'ordered' && (
              <>
                <Button
                  onClick={handleCancelOrder}
                  disabled={cancelOrder.isPending}
                  className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 text-rose-400 font-semibold"
                >
                  <XCircle size={14} className="mr-1.5" />
                  Cancel Order
                </Button>
                <Button
                  onClick={() => setIsReceiptOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  <CheckCircle2 size={14} className="mr-1.5" />
                  Receive Influx
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
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2">
              Supplier Overview
            </h3>
            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-0.5">Supplier Name</span>
                <span className="font-semibold text-neutral-200">{po.supplier_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-0.5">Supplier Code</span>
                <span className="font-mono text-neutral-300 font-bold">{po.supplier_code}</span>
              </div>
            </div>
          </div>

          {/* Logistics & Registry Audit Trail */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2 flex items-center justify-between">
              <span>Ledger Metadata</span>
              <User size={14} className="text-neutral-500" />
            </h3>
            <div className="space-y-3.5 text-sm font-sans">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-0.5">Issued By</span>
                <span className="text-neutral-300">{po.creator_name || 'N/A'}</span>
              </div>
              {po.status === 'received' && (
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold block mb-0.5">Received By</span>
                  <span className="text-neutral-300">{po.receiver_name || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Notes */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-2 flex items-center space-x-1.5">
              <FileText size={13} className="text-neutral-500" />
              <span>Logistics Notes</span>
            </h3>
            <p className="text-neutral-400 italic bg-neutral-950/50 p-3 rounded-lg border border-neutral-850 text-xs leading-relaxed max-w-full break-words">
              {po.notes || 'No custom delivery terms or audit logs specified.'}
            </p>
          </div>
        </div>

        {/* Right Side: Financial Recaps & Items Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Breakdown Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-neutral-800 bg-neutral-900/20">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">Subtotal</span>
              <span className="text-base font-mono font-bold text-neutral-300">{formatCurrency(po.subtotal)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">Discount</span>
              <span className="text-base font-mono font-bold text-rose-400">-{formatCurrency(po.discount_amount)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block">Tax</span>
              <span className="text-base font-mono font-bold text-neutral-300">+{formatCurrency(po.tax_amount)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold block text-emerald-500">Grand Total</span>
              <span className="text-lg font-mono font-extrabold text-emerald-400">{formatCurrency(po.total)}</span>
            </div>
          </div>

          {/* Items Order List Table */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-hidden">
            <div className="border-b border-neutral-800 bg-neutral-950 px-5 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-200">Purchase Line Items</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                {po.items?.length || 0} items
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/40 text-neutral-400 font-semibold">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4 text-center">Barcode</th>
                    <th className="py-3 px-4 text-center">Ordered Qty</th>
                    {po.status === 'received' && <th className="py-3 px-4 text-center">Received Qty</th>}
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 font-sans text-neutral-200">
                  {po.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-neutral-900/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold">{item.product_name}</div>
                        {item.product_name_ar && (
                          <div className="text-[10px] text-neutral-500 font-normal dir-rtl mt-0.5">
                            {item.product_name_ar}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-500">
                        {item.barcode || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-neutral-300">
                        {item.ordered_quantity}
                      </td>
                      {po.status === 'received' && (
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          {item.received_quantity}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center text-neutral-500 font-mono uppercase">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-300">
                        {formatCurrency(item.unit_cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-neutral-100">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
