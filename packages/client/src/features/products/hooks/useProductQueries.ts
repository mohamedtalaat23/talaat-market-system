import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  name_ar: string | null;
  description: string | null;
  category_id: number | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_name_ar?: string | null;
  inventory_quantity?: number;
  inventory_reserved_quantity?: number;
}

export interface Category {
  id: number;
  name: string;
  name_ar: string | null;
  parent_id: number | null;
  is_active: boolean;
}

export interface ProductFilters {
  page: number;
  limit: number;
  search?: string;
  category_id?: number | null;
}

export interface ProductsResponse {
  success: boolean;
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateProductInput {
  barcode?: string | null;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  category_id?: number | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  is_active: boolean;
  initial_quantity: number;
}

export interface UpdateProductInput {
  barcode?: string | null;
  name?: string;
  name_ar?: string | null;
  description?: string | null;
  category_id?: number | null;
  unit?: string;
  cost_price?: number;
  selling_price?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  is_active?: boolean;
}

/**
 * Hook to retrieve products with pagination and filters.
 */
export function useProducts(filters: ProductFilters) {
  return useQuery<ProductsResponse>({
    queryKey: ['products', filters],
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
      
      const response = await apiClient.get<ProductsResponse>('/products', { params });
      return response.data;
    },
    placeholderData: (previousData) => previousData, // smooth pagination transitions
  });
}

/**
 * Hook to fetch active categories.
 */
export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Category[] }>('/categories');
      return response.data?.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes stale time
  });
}

/**
 * Hook to create a product.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation<Product, Error, CreateProductInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<{ success: boolean; data: Product }>('/products', input);
      return response.data.data;
    },
    onSuccess: () => {
      // Invalidate products query to trigger cache refresh
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * Hook to update an existing product.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation<Product, Error, { id: number; data: UpdateProductInput }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<{ success: boolean; data: Product }>(`/products/${id}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

/**
 * Hook to soft-delete a product.
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
