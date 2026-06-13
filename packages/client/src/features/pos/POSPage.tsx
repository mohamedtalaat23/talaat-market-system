import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOSStore } from './usePOSStore';
import { apiClient } from '@/services/api-client';
import { POSSummary } from './components/POSSummary';
import { POSTopBar } from './components/POSTopBar';
import { POSKeyboardHandler } from './components/POSKeyboardHandler';
import { ProductSearchFallback } from './components/ProductSearchFallback';
import { ManagerOverrideModal } from './components/ManagerOverrideModal';
import { PaymentModal } from './components/PaymentModal';
import { DiscountModal } from './components/DiscountModal';
import { SuspendedCartsModal } from './components/SuspendedCartsModal';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';
import { NoShiftOverlay } from './components/NoShiftOverlay';
import { OpenShiftModal } from './components/OpenShiftModal';
import { CloseShiftModal } from './components/CloseShiftModal';
import TransactionSearchModal from './components/TransactionSearchModal';
import { RefundModal } from './components/RefundModal';
import { DrawerAdjustmentModal } from './components/DrawerAdjustmentModal';
import { CustomerSelectModal } from './components/CustomerSelectModal';
import { QuantityModal } from './components/QuantityModal';
import { QuickReturnWorkspace } from './components/QuickReturnWorkspace';
import { useModalStore } from '@/stores/modalStore';
import { PrintQueueMonitor } from './components/PrintQueueMonitor';
import { useShiftHeartbeat } from './hooks/useShiftHeartbeat';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { FastPinLockscreen } from './components/FastPinLockscreen';
import { useCategories, useProducts, type Product } from '@/features/products/hooks/useProductQueries';
import toast from 'react-hot-toast';

export function POSPage() {
  const navigate = useNavigate();
  const openModal = useModalStore((state) => state.openModal);
  const activeModals = useModalStore((state) => state.activeModals);
  const closeModal = useModalStore((state) => state.closeModal);
  const addItem = usePOSStore((state) => state.addItem);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerMultiplier, setScannerMultiplier] = useState<number | null>(null);

  // 1. Category and Product States
  const [selectedCategory, setSelectedCategory] = useState<'all' | number>('all');
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  // Widget expand states removed in UI.6 Rework

  // Expose stores to window for E2E testing inspection/control
  useEffect(() => {
    (window as any).__modalStore = useModalStore;
    (window as any).__posStore = usePOSStore;
  }, [openModal]);

  // Trigger Manager PIN override popup on mount before unlocking page
  useEffect(() => {
    openModal('pos_manager_override', {
      action: 'enter_pos',
      onCancel: () => {
        navigate('/');
      },
    });
  }, [openModal, navigate]);

  // Open transaction search modal on mount if specified in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('modal') === 'transaction_search') {
      openModal('pos_transaction_search');
    }
  }, [openModal]);

  // Activate shift heartbeat validation poller
  useShiftHeartbeat();

  // Use stable selectors for performance
  const cart = usePOSStore((state) => state.cart);
  const paymentMethod = usePOSStore((state) => state.paymentMethod);
  const cashReceived = usePOSStore((state) => state.cashReceived);
  const setActiveShift = usePOSStore((state) => state.setActiveShift);
  const activeShift = usePOSStore((state) => state.activeShift);
  const lastSaleId = usePOSStore((state) => state.lastSaleId);
  const heldCarts = usePOSStore((state) => state.heldCarts);
  const selectedCustomer = usePOSStore((state) => state.selectedCustomer);
  const idleTimeoutMs = usePOSStore((state) => state.idleTimeoutMs);

  // Initialize auto-lock idle timer
  const { isIdle, resetTimer, setIsIdle } = useIdleTimer(idleTimeoutMs);

  useEffect(() => {
    const handleManualLock = () => setIsIdle(true);
    window.addEventListener('pos:manual-lock', handleManualLock);
    return () => window.removeEventListener('pos:manual-lock', handleManualLock);
  }, [setIsIdle]);

  // Scanner flash effect when an item is added to the cart
  const cartLength = cart.length;
  const prevCartLengthRef = useRef(cartLength);
  const [scannerFlash, setScannerFlash] = useState(false);

  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      setScannerFlash(true);
      const timer = setTimeout(() => setScannerFlash(false), 150);
      return () => clearTimeout(timer);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart.length]);

  // Refocus Search Input Scanner Workflow
  const focusSearchInput = () => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Enforce autofocus after modal closures, customer selection, or item changes
  useEffect(() => {
    const hasActiveModal = Object.values(activeModals).some((isOpen) => isOpen);
    if (!hasActiveModal) {
      focusSearchInput();
    }
  }, [activeModals, cart.length, heldCarts.length, selectedCustomer]);

  // Fetch initial shift
  useEffect(() => {
    const fetchShift = async () => {
      try {
        const response = await apiClient.get<{ success: boolean; data: any }>(
          '/pos/shifts/current',
        );
        if (response.data?.success) {
          setActiveShift(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch current shift', error);
        setActiveShift(null);
      }
    };
    fetchShift();
  }, []);

  // Shift summary fetching removed in UI.6 Rework

  // Fetch categories using React Query hook
  const { data: categories = [] } = useCategories();

  // Fetch products for current active category (max 24)
  const { data: categoryProductsData, isLoading: isProductsLoading } = useProducts({
    page: 1,
    limit: 24,
    category_id: selectedCategory === 'all' ? null : selectedCategory,
  });
  const products = categoryProductsData?.data || [];

  // Fetch recent sales and aggregate top selling products for the empty grid state
  const loadRecentActivities = async () => {
    try {
      // Fetch larger sample for accurate top-selling data
      const salesResponse = await apiClient.get<{ success: boolean; data: any[] }>(
        '/pos/sales/search?limit=100'
      );
      if (salesResponse.data?.success && salesResponse.data?.data) {
        const sales = salesResponse.data.data;

        const frequencyMap = new Map<number, number>();
        const productMap = new Map<number, Product>();
        const recentOrder: number[] = [];

        sales.forEach((sale: any) => {
          sale.items?.forEach((item: any) => {
            const id = item.product_id;
            frequencyMap.set(id, (frequencyMap.get(id) || 0) + Number(item.quantity));
            
            if (!productMap.has(id)) {
              productMap.set(id, {
                id: item.product_id,
                barcode: item.barcode,
                name: item.product_name,
                name_ar: item.name_ar || null,
                selling_price: Number(item.unit_price),
                unit: item.unit || 'pcs',
                inventory_quantity: item.inventory_quantity || 100,
                cost_price: 0,
                min_stock_level: 0,
                max_stock_level: 0,
                is_active: true,
                created_at: '',
                updated_at: '',
                description: null,
                category_id: null,
              });
            }
            if (!recentOrder.includes(id)) {
              recentOrder.push(id);
            }
          });
        });

        // Top 4 selling products
        const topSellingIds = Array.from(frequencyMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(entry => entry[0]);
        
        setFavoriteProducts(topSellingIds.map(id => productMap.get(id)!));

        // Top 4 recent products (excluding favorites)
        const recentIds = recentOrder
          .filter(id => !topSellingIds.includes(id))
          .slice(0, 4);
          
        setRecentProducts(recentIds.map(id => productMap.get(id)!));
      }
    } catch (err) {
      console.error('Failed to load recent activities:', err);
    }
  };

  useEffect(() => {
    loadRecentActivities();
  }, [lastSaleId]);

  // Auto-focus search input on mount and global Esc/F5 presses
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleGlobalKeys = (e: KeyboardEvent) => {
      const hasActiveModal = Object.values(useModalStore.getState().activeModals).some(isOpen => isOpen);
      if (e.key === 'Escape' && !hasActiveModal) {
        searchInputRef.current?.focus();
        setScannerMultiplier(null);
      }
      if (e.key === 'F5' && !hasActiveModal) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    let query = searchQuery.trim();
    setSearchQuery('');

    // Check for standalone multiplier (e.g. "12*" or "24x")
    const standaloneMatch = query.match(/^(\d+)[*xX]$/);
    if (standaloneMatch && standaloneMatch[1]) {
      setScannerMultiplier(parseInt(standaloneMatch[1], 10));
      return; // Wait for the next scan
    }

    // Check for combined multiplier + barcode (e.g. "12*628123")
    let quantity = scannerMultiplier || 1;
    const combinedMatch = query.match(/^(\d+)[*xX](.+)$/);
    if (combinedMatch && combinedMatch[1] && combinedMatch[2]) {
      quantity = parseInt(combinedMatch[1], 10);
      query = combinedMatch[2].trim();
    }
    
    // reset multiplier after extraction
    setScannerMultiplier(null);

    if (!usePOSStore.getState().activeShift) {
      toast.error('Cannot look up product when shift is closed');
      return;
    }

    const loadingToastId = toast.loading(`Looking up: "${query}"`);
    try {
      const response = await apiClient.get<{ success: boolean; data: any }>(
        `/products/barcode/${query}`,
      );
      toast.dismiss(loadingToastId);

      if (response.data?.success && response.data?.data) {
        const product = response.data.data;
        if (!product.is_active) {
          toast.error(`Product "${product.name}" is inactive`);
          return;
        }

        addItem({
          product_id: product.id,
          barcode: product.barcode,
          name: product.name,
          name_ar: product.name_ar,
          unit_price: product.selling_price,
          quantity: quantity,
          discount: 0,
          unit: product.unit,
          inventory_quantity: product.inventory_quantity || 0,
        });
        toast.success(`Added ${product.name}`);
        focusSearchInput();
        return;
      }
    } catch (error) {
      toast.dismiss(loadingToastId);
    }

    openModal('pos_product_search', { initialSearch: query });
  };

  // Keyboard navigation inside Category Strip
  const handleCategoryKeyDown = (e: React.KeyboardEvent, index: number, total: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % total;
      const nextBtn = document.getElementById(`cat-btn-${nextIndex}`) as HTMLButtonElement;
      nextBtn?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + total) % total;
      const prevBtn = document.getElementById(`cat-btn-${prevIndex}`) as HTMLButtonElement;
      prevBtn?.focus();
    }
  };

  const handleAddProduct = (product: Product) => {
    if (!activeShift) {
      toast.error('Shift is not open.');
      return;
    }
    addItem({
      product_id: product.id,
      barcode: product.barcode,
      name: product.name,
      name_ar: product.name_ar,
      unit_price: product.selling_price,
      quantity: 1,
      discount: 0,
      unit: product.unit,
      inventory_quantity: product.inventory_quantity || 0,
    });
    toast.success(`Added ${product.name}`);
    focusSearchInput();
  };

  const categoriesWithAll = [{ id: 'all' as any, name: 'All Products', name_ar: 'الكل' }, ...categories];

  return (
    <div
      className={`flex flex-col h-screen w-screen bg-[#f8fafc] text-foreground overflow-hidden select-none transition-colors duration-fast ${
        scannerFlash ? 'animate-scanner-flash' : ''
      }`}
    >
      <FastPinLockscreen isOpen={isIdle} onSuccess={resetTimer} />
      
      <POSTopBar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Subtle background blur spheres for depth */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[60%] bg-success/5 rounded-full blur-[120px] pointer-events-none" />

        {/* ── Left Panel (65% width) - Main Workspace ── */}
        <div className="w-[65%] flex flex-col h-full border-r border-border/30 bg-white overflow-hidden relative z-10">
          
          {/* Search bar input (Scanner focus target) */}
          <form onSubmit={handleSearchSubmit} className="px-5 py-3 bg-white border-b border-border/30 shrink-0">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <svg className="w-4 h-4 text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={scannerMultiplier ? `${scannerMultiplier}× — scan next item... (Esc to cancel)` : "Scan barcode or type name to search... (F5)"}
                className="w-full h-11 bg-[#f4f7fa] border border-border/50 text-base text-foreground placeholder-neutral-400 pl-10 pr-16 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl font-sans select-text transition-all duration-200"
              />
              <kbd className="absolute right-3 top-2.5 text-[10px] font-mono font-bold text-neutral-400 border border-neutral-200 bg-white px-1.5 py-0.5 rounded opacity-0 group-focus-within:opacity-100 transition-opacity shadow-sm">
                ENTER
              </kbd>
            </div>
          </form>

          {/* Independently Scrollable Left Container */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Category Strip */}
            <div className="px-5 py-3 border-b border-border/20 bg-[#f8fafc]">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {categoriesWithAll.map((cat, idx) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      id={`cat-btn-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        focusSearchInput();
                      }}
                      onKeyDown={(e) => handleCategoryKeyDown(e, idx, categoriesWithAll.length)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shrink-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 border ${
                        isActive
                          ? 'bg-primary text-white border-transparent shadow-[0_2px_8px_rgba(16,185,129,0.3)]'
                          : 'bg-white text-secondary border-border/60 hover:text-foreground hover:border-border hover:shadow-sm'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products area with padding */}
            <div className="p-5 space-y-6">

            {/* Touch Products Panel */}
              {isProductsLoading && products.length === 0 ? (
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-neutral-100 border border-border/30 rounded-2xl aspect-square" />
                  ))}
                </div>
              ) : selectedCategory === 'all' ? (
                <div className="space-y-7">
                  {/* ── Favorites ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-5 w-1 rounded-full bg-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-secondary">Top Sellers</h3>
                    </div>
                    {favoriteProducts.length === 0 ? (
                      <p className="text-xs text-secondary/60 italic py-2">Building favorites from sales data...</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {favoriteProducts.map((prod) => (
                          <button
                            key={`fav-${prod.id}`}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className="group border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white hover:from-amber-100/60 hover:border-amber-300 active:scale-[0.97] transition-all duration-200 px-3 py-4 rounded-2xl flex flex-col items-start text-left focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm hover:shadow-md relative overflow-hidden"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 mb-3 group-hover:scale-110 transition-transform duration-200">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            </div>
                            <span className="font-bold text-sm text-foreground line-clamp-2 leading-tight mb-2">{prod.name}</span>
                            <span className="font-mono font-black text-amber-600 text-sm mt-auto">EGP {prod.selling_price.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* ── Recent ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-5 w-1 rounded-full bg-blue-400" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-secondary">Recent Scans</h3>
                    </div>
                    {recentProducts.length === 0 ? (
                      <p className="text-xs text-secondary/60 italic py-2">Scan items to build recency...</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {recentProducts.map((prod) => (
                          <button
                            key={`rec-${prod.id}`}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className="group border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white hover:from-blue-50 hover:border-blue-200 active:scale-[0.97] transition-all duration-200 px-3 py-4 rounded-2xl flex flex-col items-start text-left focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm hover:shadow-md relative overflow-hidden"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-500 mb-3 group-hover:scale-110 transition-transform duration-200">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            </div>
                            <span className="font-bold text-sm text-foreground line-clamp-2 leading-tight mb-2">{prod.name}</span>
                            <span className="font-mono font-black text-blue-600 text-sm mt-auto">EGP {prod.selling_price.toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : products.length === 0 ? (
                <div className="border border-border/40 rounded-2xl p-10 text-center text-sm font-medium text-secondary bg-white">
                  No products in this category.
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-5 w-1 rounded-full bg-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-secondary">Category Products</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {products.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddProduct(prod)}
                        className="group border border-border/50 bg-white hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.97] transition-all duration-200 px-3 py-4 rounded-2xl flex flex-col items-start text-left focus:outline-none focus:ring-2 focus:ring-primary shadow-sm hover:shadow-md"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3 group-hover:scale-110 transition-transform duration-200">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        </div>
                        <span className="font-bold text-sm text-foreground line-clamp-2 leading-tight mb-2">{prod.name}</span>
                        <span className="font-mono font-black text-primary text-sm mt-auto">EGP {prod.selling_price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ── Right Panel (35% width) - Checkout ── */}
        <div className="w-[35%] flex flex-col bg-[#f8fafc] overflow-hidden h-full">
          <POSSummary cart={cart} paymentMethod={paymentMethod} cashReceived={cashReceived} />
          <PrintQueueMonitor />
        </div>

      </div>

      {/* Invisible global keyboard listener for shortcuts and barcode scanning */}
      <POSKeyboardHandler />

      {/* Overlays */}
      <NoShiftOverlay />
      <OpenShiftModal />
      <CloseShiftModal />
      <TransactionSearchModal />
      <RefundModal />
      <DrawerAdjustmentModal />
      <ProductSearchFallback />
      <ManagerOverrideModal />
      <PaymentModal />
      <DiscountModal />
      <SuspendedCartsModal />
      <ReceiptPreviewModal />
      <QuantityModal />
      <QuickReturnWorkspace />
      <CustomerSelectModal
        isOpen={activeModals.pos_customer_select}
        onClose={() => closeModal('pos_customer_select')}
      />
    </div>
  );
}

export default POSPage;
