import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface InventoryItem {
  id: number;
  product_id: number;
  quantity: number;
  reserved_quantity: number;
  last_counted_at: string | null;
  updated_at: string;
  product_barcode: string | null;
  product_name: string;
  product_name_ar: string | null;
  product_unit: string;
  product_min_stock_level: number;
  product_selling_price: number;
  category_name?: string | null;
  category_name_ar?: string | null;
}

export interface InventoryAdjustment {
  id: number;
  product_id: number;
  product_name: string;
  product_barcode: string | null;
  product_unit: string;
  adjustment_type: 'stock_addition' | 'stock_removal' | 'damaged' | 'expired' | 'manual_correction';
  quantity_change: number;
  old_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_by: number | null;
  creator_name: string | null;
  created_at: string;
}

export interface InventoryFilters {
  page: number;
  limit: number;
  search?: string;
  category_id?: number | null;
  low_stock_only?: boolean;
}

export interface InventoryResponse {
  success: boolean;
  data: InventoryItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdjustStockInput {
  product_id: number;
  adjustment_type: 'stock_addition' | 'stock_removal' | 'damaged' | 'expired' | 'manual_correction';
  quantity_change: number;
  notes?: string | null;
}

export interface DirectStockInput {
  productId: number;
  quantity: number;
  notes?: string | null;
}

export interface AdjustmentsResponse {
  success: boolean;
  data: InventoryAdjustment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Hook to retrieve current inventory levels.
 */
export function useInventory(filters: InventoryFilters) {
  return useQuery<InventoryResponse>({
    queryKey: ['inventory', filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.search) {
        params.search = filters.search;
      }

      if (filters.category_id) {
        params.category_id = filters.category_id;
      }

      if (filters.low_stock_only) {
        params.low_stock_only = 'true';
      }

      const response = await apiClient.get<InventoryResponse>('/inventory', { params });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to retrieve dynamic active categories (reused for filters).
 */
export function useInventoryCategories() {
  return useQuery<Array<{ id: number; name: string; name_ar: string | null }>>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<{
        success: boolean;
        data: Array<{ id: number; name: string; name_ar: string | null }>;
      }>('/categories');
      return response.data?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to perform dynamic relative adjustments (adds, removals, damage, expiry).
 */
export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation<InventoryItem, Error, AdjustStockInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<{ success: boolean; data: InventoryItem }>(
        '/inventory/adjust',
        input,
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
    },
  });
}

/**
 * Hook to perform manual direct stock override correction.
 */
export function useSetStockDirectly() {
  const queryClient = useQueryClient();
  return useMutation<InventoryItem, Error, DirectStockInput>({
    mutationFn: async ({ productId, quantity, notes }) => {
      const response = await apiClient.put<{ success: boolean; data: InventoryItem }>(
        `/inventory/${productId}`,
        {
          quantity,
          notes,
        },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
    },
  });
}

/**
 * Hook to query stock adjustments history logs.
 */
export function useInventoryAdjustments(filters: {
  page: number;
  limit: number;
  product_id?: number | undefined;
}) {
  return useQuery<AdjustmentsResponse>({
    queryKey: ['inventory-adjustments', filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.product_id) {
        params.product_id = filters.product_id;
      }

      const response = await apiClient.get<AdjustmentsResponse>('/inventory/adjustments', {
        params,
      });
      return response.data;
    },
  });
}
