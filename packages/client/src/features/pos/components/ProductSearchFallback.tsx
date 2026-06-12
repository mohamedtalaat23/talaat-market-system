import { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { useModalStore } from '@/stores/modalStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePOSStore } from '../usePOSStore';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import type { Product } from '@/features/products/hooks/useProductQueries';

export function ProductSearchFallback() {
  const isOpen = useModalStore((state) => state.activeModals.pos_product_search);
  const closeModalAction = useModalStore((state) => state.closeModal);
  const payload = useModalStore((state) => state.modalPayloads.pos_product_search);
  const closeModal = () => closeModalAction('pos_product_search');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const addItem = usePOSStore((state) => state.addItem);

  // Sync search input with modal payload when opened
  useEffect(() => {
    if (isOpen) {
      if (payload?.initialSearch) {
        setSearchTerm(payload.initialSearch);
        setDebouncedSearch(payload.initialSearch);
      } else {
        setSearchTerm('');
        setDebouncedSearch('');
      }
      setSelectedIndex(0);
    }
  }, [isOpen, payload]);

  // Debounce search requests to prevent excessive API hits.
  // 400 ms gives the cashier time to finish typing 2-3 characters
  // before a query fires. Only triggers when at least 2 chars are present.
  useEffect(() => {
    if (!isOpen) return;
    if (payload?.initialSearch && searchTerm === payload.initialSearch) {
      return;
    }
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, isOpen, payload]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.body.focus();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Only show results when search term has at least 2 characters
  const showResults = debouncedSearch.trim().length >= 2;

  // Lightweight POS product search — hits /pos/products/search instead of
  // /products, which skips the COUNT(*) query and returns top matches only.
  const { data, isLoading } = useQuery<{ success: boolean; data: Product[] }>({
    queryKey: ['pos-product-search', debouncedSearch],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Product[] }>(
        '/pos/products/search',
        {
          params: { q: debouncedSearch, limit: 20 },
        },
      );
      return response.data;
    },
    enabled: isOpen && showResults,
  });

  const products = data?.data || [];

  // Reset selected index when products list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [products]);

  if (!isOpen) return null;

  const onSelectProduct = (product: Product) => {
    if (!product.is_active) {
      toast.error(`Product "${product.name}" is inactive and cannot be sold`);
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

    toast.success(`Added ${product.name} to cart`);
    setSearchTerm('');
    closeModal();
    // Return focus to scanner workflow
    document.body.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      closeModal();
      document.body.focus();
      return;
    }

    if (products.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < products.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedProduct = products[selectedIndex];
    if (selectedProduct) {
      onSelectProduct(selectedProduct);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          closeModal();
          document.body.focus();
        }}
        aria-hidden="true"
      />

      <div
        ref={focusTrapRef}
        className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-xl relative z-10 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3
            id="search-modal-title"
            className="text-lg font-bold text-foreground flex items-center space-x-2"
          >
            <Search size={18} className="text-secondary" />
            <span>Product Search</span>
          </h3>
          <button
            onClick={() => {
              closeModal();
              document.body.focus();
            }}
            className="rounded-md p-1.5 text-secondary hover:text-foreground hover:bg-card-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="search-input" className="sr-only">
                Search Product
              </label>
              <input
                id="search-input"
                autoFocus
                type="text"
                placeholder="Type name, SKU, or Arabic name... (Press Enter to add)"
                className="w-full bg-input-bg border border-input-border rounded p-3 text-input-text placeholder:text-input-placeholder focus:outline-none focus:border-input-focus focus:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
            </div>

            <div className="h-64 overflow-y-auto border border-border rounded bg-background/50 p-2 space-y-1">
              {isLoading ? (
                <div className="p-3 text-secondary text-sm text-center mt-16 font-mono">
                  Loading matching products...
                </div>
              ) : !showResults ? (
                <div className="p-3 text-secondary text-sm text-center mt-16">
                  Type at least 2 characters to search products by name, SKU, or barcode...
                </div>
              ) : products.length === 0 ? (
                <div className="p-3 text-danger text-sm text-center mt-16 font-mono">
                  No products found for "{debouncedSearch}"
                </div>
              ) : (
                products.map((product, index) => {
                  const isSelected = index === selectedIndex;
                  const isOutOfStock =
                    product.inventory_quantity !== undefined && product.inventory_quantity <= 0;
                  const isInactive = !product.is_active;

                  return (
                    <div
                      key={product.id}
                      onClick={() => onSelectProduct(product)}
                      className={`flex items-center justify-between p-2.5 rounded cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-success/90/10 text-success border-success/30'
                          : 'bg-card/40 text-secondary border-transparent hover:bg-card-hover/40 hover:text-foreground'
                      } ${isInactive ? 'opacity-50' : ''}`}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium truncate">{product.name}</span>
                          {product.name_ar && (
                            <span
                              className="text-xs text-secondary font-medium truncate dir-rtl"
                              lang="ar"
                            >
                              ({product.name_ar})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-secondary mt-0.5">
                          <span>SKU: {product.id}</span>
                          <span>Barcode: {product.barcode || 'N/A'}</span>
                          <span>
                            Stock:{' '}
                            {product.inventory_quantity !== undefined
                              ? `${product.inventory_quantity} ${product.unit}`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 ml-4">
                        <div className="flex flex-col items-end">
                          <span
                            className={`text-sm font-bold ${isSelected ? 'text-success' : 'text-foreground'}`}
                          >
                            {product.selling_price.toFixed(2)} EGP
                          </span>
                        </div>
                        <div className="flex flex-col space-y-1">
                          {isInactive && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-danger/15 text-danger border border-danger/20">
                              INACTIVE
                            </span>
                          )}
                          {isOutOfStock && !isInactive && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-warning/15 text-warning border border-warning/20">
                              OUT OF STOCK
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
