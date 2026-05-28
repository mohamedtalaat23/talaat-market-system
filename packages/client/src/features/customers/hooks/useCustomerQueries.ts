import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CustomerTransaction {
  id: number;
  customer_id: number;
  transaction_type: 'sale' | 'payment' | 'adjustment';
  amount: number;
  reference_id: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  created_by_name?: string | null;
}

export interface CustomerDetail extends Customer {
  ledger: CustomerTransaction[];
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  balance?: number;
  loyalty_points?: number;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  loyalty_points?: number;
}

export interface RecordPaymentPayload {
  amount: number;
  notes?: string | null;
}

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ status: string; data: Customer[] }>('/customers', {
        params: { q: search || undefined },
      });
      return data.data;
    },
  });
}

export function useCustomerDetail(id: number) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ status: string; data: CustomerDetail }>(`/customers/${id}`);
      return data.data;
    },
    enabled: !isNaN(id) && id > 0,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCustomerPayload) => {
      const { data } = await apiClient.post<{ status: string; data: Customer }>('/customers', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer profile registered');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to register customer';
      toast.error(message);
    },
  });
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateCustomerPayload) => {
      const { data } = await apiClient.put<{ status: string; data: Customer }>(`/customers/${id}`, payload);
      return data.data;
    },
    onSuccess: (updatedCustomer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.setQueryData(['customer', id], (oldData: any) => {
        if (!oldData) return undefined;
        return {
          ...oldData,
          ...updatedCustomer,
        };
      });
      toast.success('Customer profile updated');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to update customer profile';
      toast.error(message);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete<{ status: string; message: string }>(`/customers/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer profile deleted');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to delete customer profile';
      toast.error(message);
    },
  });
}

export function useRecordPayment(customerId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      const { data } = await apiClient.post<{ status: string; data: Customer }>(
        `/customers/${customerId}/payments`,
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to record payment';
      toast.error(message);
    },
  });
}
