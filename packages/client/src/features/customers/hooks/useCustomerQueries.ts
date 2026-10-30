import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';
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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  payment_method?: 'cash' | 'card';
  /** Client-generated key so a retried submission cannot post twice. */
  idempotency_key?: string;
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
  if (filters.sortBy) {
    mappedFilters.sortBy = filters.sortBy;
  }
  if (filters.sortOrder) {
    mappedFilters.sortOrder = filters.sortOrder;
  }

  return useGenericListQuery<Customer, Record<string, any>>(
    'customers',
    '/customers',
    mappedFilters,
  );
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
      const { data } = await apiClient.get<{ status: string; data: CustomerDetail }>(
        `/customers/${id}`,
        {
          params: { ledger_page: ledgerPage, ledger_limit: 50 },
        },
      );
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
    'Customer profile registered',
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
    'Customer profile updated',
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
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      // A fresh key per submission makes the request idempotent: if the response
      // is lost and the cashier retries, the server returns the original payment
      // instead of posting a second one.
      const { data } = await apiClient.post<{
        status: string;
        data: Customer;
        meta?: { duplicate?: boolean; outstanding_after?: number };
      }>(`/customers/${customerId}/payments`, {
        ...payload,
        idempotency_key: payload.idempotency_key ?? crypto.randomUUID(),
      });
      return data;
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success(
        response?.meta?.duplicate
          ? t('customers.paymentAlreadyRecorded')
          : t('customers.paymentSuccess'),
      );
    },
    onError: (error: any) => {
      // The server rejects overpayments (409), payments with no outstanding
      // balance (409) and requests made without an open shift (400) with a
      // machine-readable code; surface its message rather than a generic one.
      const message =
        error?.response?.data?.message || error.message || t('customers.paymentFailed');
      toast.error(message);
    },
  });
}
