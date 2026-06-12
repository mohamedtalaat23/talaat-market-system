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
      className={`flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden select-none transition-colors duration-fast ${
        scannerFlash ? 'animate-scanner-flash' : ''
      }`}
    >
      <FastPinLockscreen isOpen={isIdle} onSuccess={resetTimer} />
      
      <POSTopBar />

      <div className="flex flex-1 overflow-hidden">
        
        {/* ── Left Panel (65% width) - Main Workspace ── */}
        <div className="w-[65%] flex flex-col h-full border-r border-border bg-neutral-50 overflow-hidden">
          
          {/* Search bar input (Scanner focus target) */}
          <form onSubmit={handleSearchSubmit} className="p-2.5 bg-white border-b border-border shrink-0">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={scannerMultiplier ? `${scannerMultiplier}x Next Scan... (Esc to cancel)` : "Scan barcode or type name to search... (F5)"}
                className="w-full bg-neutral-100 border border-border text-sm text-foreground placeholder-neutral-500 px-4 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded font-mono select-text"
              />
              <div className="absolute right-3 top-2 text-xs font-mono font-bold text-neutral-500 border border-neutral-300 bg-white px-1.5 py-0.5 rounded">
                ENTER
              </div>
            </div>
          </form>

          {/* Independently Scrollable Left Container */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0">
            
            {/* Horizontal Category Strip */}
            <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1">
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
                    className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-white hover:bg-neutral-100 text-secondary border border-border'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Touch Products Panel */}
            <div>
              {isProductsLoading && products.length === 0 ? (
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 animate-pulse">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white border border-border rounded h-[80px]" />
                  ))}
                </div>
              ) : selectedCategory === 'all' ? (
                <div className="space-y-6">
                  {/* Favorites Grid */}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-secondary mb-3 flex items-center gap-1.5">
                      <span className="text-yellow-500">⭐</span> Favorites
                    </h3>
                    {favoriteProducts.length === 0 ? (
                      <div className="text-xs text-secondary italic">Building favorites from sales data...</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {favoriteProducts.map((prod) => (
                          <button
                            key={`fav-${prod.id}`}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className="bg-yellow-50/40 border border-yellow-200/60 hover:border-yellow-400 hover:shadow-md active:scale-95 transition-all p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 shadow-xs"
                          >
                            <div className="flex-1 flex items-center justify-center text-4xl mb-2 opacity-90 drop-shadow-sm">
                              ⭐
                            </div>
                            <span className="font-bold text-sm text-foreground line-clamp-2 w-full mb-2">
                              {prod.name}
                            </span>
                            <span className="font-mono font-black text-primary text-base">
                              EGP {prod.selling_price.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Recent Grid */}
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-secondary mb-3 flex items-center gap-1.5">
                      <span className="text-blue-500">🕒</span> Recent Scans
                    </h3>
                    {recentProducts.length === 0 ? (
                      <div className="text-xs text-secondary italic">Scan items to build recency...</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {recentProducts.map((prod) => (
                          <button
                            key={`rec-${prod.id}`}
                            type="button"
                            onClick={() => handleAddProduct(prod)}
                            className="bg-white border border-border hover:border-primary hover:shadow-md active:scale-95 transition-all p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square focus:outline-none focus:border-primary shadow-xs"
                          >
                            <div className="flex-1 flex items-center justify-center text-4xl mb-2 opacity-80">
                              🕒
                            </div>
                            <span className="font-bold text-sm text-foreground line-clamp-2 w-full mb-2">
                              {prod.name}
                            </span>
                            <span className="font-mono font-black text-primary text-base">
                              EGP {prod.selling_price.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-border rounded-lg p-6 text-center text-xs text-secondary">
                  No products loaded in this category.
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-secondary mb-3">
                    Category Products
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddProduct(prod)}
                        className="bg-white border border-border hover:border-primary hover:shadow-md active:scale-95 transition-all p-4 rounded-xl flex flex-col items-center justify-center text-center aspect-square focus:outline-none focus:border-primary shadow-xs"
                      >
                        <div className="flex-1 flex items-center justify-center text-4xl mb-2 opacity-80">
                          📦
                        </div>
                        <span className="font-bold text-sm text-foreground line-clamp-2 w-full mb-2">
                          {prod.name}
                        </span>
                        <span className="font-mono font-black text-primary text-base">
                          EGP {prod.selling_price.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ── Right Panel (35% width) - Checkout ── */}
        <div className="w-[35%] flex flex-col bg-white overflow-hidden h-full">
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
      <CustomerSelectModal
        isOpen={activeModals.pos_customer_select}
        onClose={() => closeModal('pos_customer_select')}
      />
    </div>
  );
}

export default POSPage;
