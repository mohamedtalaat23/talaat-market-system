import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export interface PurchaseOrderItem {
  id?: number;
  purchase_order_id?: number;
  product_id: number;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
  product_name: string;
  product_name_ar: string | null;
  barcode: string | null;
  unit: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  order_date: string;
  delivery_date: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  created_by: number | null;
  received_by: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name: string;
  supplier_code: string;
  creator_name?: string | null;
  receiver_name?: string | null;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderFilters {
  page: number;
  limit: number;
  status?: string;
  supplier_id?: number;
}

export interface PaginatedPurchaseOrdersResponse {
  items: PurchaseOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreatePOPayload {
  supplier_id: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    ordered_quantity: number;
    unit_cost: number;
  }>;
}

export interface UpdatePOPayload {
  supplier_id: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    ordered_quantity: number;
    unit_cost: number;
  }>;
}

export interface ReceivePOPayload {
  items: Array<{
    product_id: number;
    received_quantity: number;
  }>;
}

/**
 * Hook to retrieve purchase orders with pagination and filters
 */
export function usePurchaseOrders(filters: PurchaseOrderFilters) {
  return useQuery<PaginatedPurchaseOrdersResponse>({
    queryKey: ['purchases', filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.supplier_id) {
        params.supplier_id = filters.supplier_id;
      }

      const response = await apiClient.get<PaginatedPurchaseOrdersResponse>('/purchases', {
        params,
      });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to retrieve detailed purchase order with items
 */
export function usePurchaseOrder(id: number) {
  return useQuery<{ success: boolean; data: PurchaseOrder }>({
    queryKey: ['purchases', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: PurchaseOrder }>(
        `/purchases/${id}`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * Hook to create a draft PO
 */
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePOPayload) => {
      const response = await apiClient.post<{ success: boolean; data: PurchaseOrder }>(
        '/purchases',
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Draft purchase order created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create draft purchase order');
    },
  });
}

/**
 * Hook to update a draft PO
 */
export function useUpdatePurchaseOrder(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePOPayload) => {
      const response = await apiClient.put<{ success: boolean; data: PurchaseOrder }>(
        `/purchases/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', id] });
      toast.success('Draft purchase order updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update draft purchase order');
    },
  });
}

/**
 * Hook to place a purchase order (transition from draft to ordered)
 */
export function usePlacePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/purchases/${id}/order`,
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', id] });
      toast.success('Purchase order placed successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to place purchase order');
    },
  });
}

/**
 * Hook to cancel a purchase order
 */
export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/purchases/${id}/cancel`,
      );
      return response.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', id] });
      toast.success('Purchase order cancelled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel purchase order');
    },
  });
}

/**
 * Hook to complete PO goods receipt
 */
export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ReceivePOPayload }) => {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/purchases/${id}/receive`,
        payload,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Goods received successfully, inventory and costs updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to process goods receipt');
    },
  });
}
