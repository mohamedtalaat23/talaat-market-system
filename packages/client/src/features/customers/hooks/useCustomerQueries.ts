import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import {
  useGenericListQuery,
  useGenericCreateMutation,
  useGenericUpdateMutation,
  useGenericDeleteMutation,
} from '@/hooks/useGenericCrud';

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
  ledger_meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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

export interface CustomerFilters {
  page: number;
  limit: number;
  search?: string;
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

/**
 * Fetch paginated list of customers using the generic list query.
 */
export function useCustomers(filters: CustomerFilters) {
  // Map our frontend filters.search property to backend q property
  const mappedFilters: Record<string, any> = {
    page: filters.page,
    limit: filters.limit,
  };
  if (filters.search) {
    mappedFilters.q = filters.search;
  }

  return useGenericListQuery<Customer, Record<string, any>>('customers', '/customers', mappedFilters);
}

/**
 * Fetch customer detail with a paginated transaction ledger.
 * @param id - Customer ID
 * @param ledgerPage - Which page of ledger transactions to fetch (default 1)
 */
export function useCustomerDetail(id: number, ledgerPage: number = 1) {
  return useQuery<CustomerDetail>({
    queryKey: ['customer', id, { ledgerPage }],
    queryFn: async () => {
      const { data } = await apiClient.get<{ status: string; data: CustomerDetail }>(`/customers/${id}`, {
        params: { ledger_page: ledgerPage, ledger_limit: 50 },
      });
      return data.data;
    },
    enabled: !isNaN(id) && id > 0,
  });
}

/**
 * Create a new customer profile using the generic create mutation.
 */
export function useCreateCustomer() {
  return useGenericCreateMutation<CreateCustomerPayload, Customer>(
    'customers',
    '/customers',
    'Customer profile registered'
  );
}

/**
 * Update an existing customer using the generic update mutation.
 * Adapts call properties for drop-in signature backward compatibility.
 */
export function useUpdateCustomer(id: number) {
  const mutation = useGenericUpdateMutation<UpdateCustomerPayload, Customer>(
    'customers',
    '/customers',
    'Customer profile updated'
  );

  return {
    ...mutation,
    mutate: (payload: UpdateCustomerPayload, options?: any) =>
      mutation.mutate({ id, payload }, options),
    mutateAsync: (payload: UpdateCustomerPayload, options?: any) =>
      mutation.mutateAsync({ id, payload }, options),
  };
}

/**
 * Soft delete a customer profile using the generic delete mutation.
 */
export function useDeleteCustomer() {
  return useGenericDeleteMutation('customers', '/customers', 'Customer profile deleted');
}

/**
 * Custom specialized customer repayment mutation.
 */
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
