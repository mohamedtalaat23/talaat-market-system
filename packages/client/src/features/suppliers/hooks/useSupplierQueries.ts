import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export interface Supplier {
  id: number;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'inactive' | 'suspended';
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  active_catalog_count: number;
}

export interface SupplierProduct {
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
  deleted_at: string | null;
  inventory_quantity: number;
  inventory_reserved_quantity: number;
}

export interface SupplierDetail extends Supplier {
  catalog: SupplierProduct[];
}

export interface PaginatedSuppliersResponse {
  items: Supplier[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateSupplierPayload {
  supplier_code?: string | null;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}

export interface UpdateSupplierPayload {
  supplier_code?: string;
  name?: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: 'active' | 'inactive' | 'suspended';
}

export function useSuppliers(search?: string, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['suppliers', search, page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedSuppliersResponse>('/suppliers', {
        params: { search: search || undefined, page, limit },
      });
      return data;
    },
  });
}

export function useSupplierDetail(id: number) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ status: string; data: SupplierDetail }>(`/suppliers/${id}`);
      return data.data;
    },
    enabled: !isNaN(id) && id > 0,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSupplierPayload) => {
      const { data } = await apiClient.post<{ status: string; data: Supplier }>('/suppliers', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier profile registered');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to register supplier';
      toast.error(message);
    },
  });
}

export function useUpdateSupplier(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateSupplierPayload) => {
      const { data } = await apiClient.put<{ status: string; data: Supplier }>(`/suppliers/${id}`, payload);
      return data.data;
    },
    onSuccess: (updatedSupplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.setQueryData(['supplier', id], (oldData: any) => {
        if (!oldData) return undefined;
        return {
          ...oldData,
          ...updatedSupplier,
        };
      });
      toast.success('Supplier profile updated');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to update supplier profile';
      toast.error(message);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete<{ status: string; message: string }>(`/suppliers/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier profile deleted successfully');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to delete supplier profile';
      toast.error(message);
    },
  });
}
