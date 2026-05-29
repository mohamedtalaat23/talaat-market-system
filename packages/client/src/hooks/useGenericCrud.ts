import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export interface PaginatedResponse<T> {
  success?: boolean;
  status?: string;
  data?: T[];
  items?: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Generic query to fetch paginated lists with filters.
 */
export function useGenericListQuery<TEntity, TFilters extends Record<string, any>>(
  queryKey: string,
  endpoint: string,
  filters: TFilters
) {
  return useQuery<PaginatedResponse<TEntity>>({
    queryKey: [queryKey, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<TEntity>>(endpoint, {
        params: filters,
      });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Generic query to fetch single item detail by ID.
 */
export function useGenericDetailQuery<TEntity>(
  queryKey: string,
  endpoint: string,
  id: number
) {
  return useQuery<TEntity>({
    queryKey: [queryKey, id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success?: boolean; status?: string; data: TEntity }>(`${endpoint}/${id}`);
      return data.data;
    },
    enabled: !isNaN(id) && id > 0,
  });
}

/**
 * Generic mutation to handle insertions with notifications and query cache invalidations.
 */
export function useGenericCreateMutation<TPayload, TEntity>(
  queryKey: string,
  endpoint: string,
  successMessage = 'Record created successfully'
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TPayload) => {
      const { data } = await apiClient.post<{ success?: boolean; status?: string; data: TEntity }>(endpoint, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(successMessage);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to create record';
      toast.error(message);
    },
  });
}

/**
 * Generic mutation to handle updates with notifications, cache invalidation, and detailed cache overrides.
 */
export function useGenericUpdateMutation<TPayload, TEntity>(
  queryKey: string,
  endpoint: string,
  successMessage = 'Record updated successfully'
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: TPayload }) => {
      const { data } = await apiClient.put<{ success?: boolean; status?: string; data: TEntity }>(`${endpoint}/${id}`, payload);
      return data.data;
    },
    onSuccess: (updatedEntity, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.setQueryData([queryKey, variables.id], updatedEntity);
      toast.success(successMessage);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to update record';
      toast.error(message);
    },
  });
}

/**
 * Generic mutation to handle soft-deletes and list cache invalidation.
 */
export function useGenericDeleteMutation(
  queryKey: string,
  endpoint: string,
  successMessage = 'Record deleted successfully'
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete<{ success?: boolean; status?: string; message?: string }>(`${endpoint}/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(successMessage);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message || 'Failed to delete record';
      toast.error(message);
    },
  });
}
