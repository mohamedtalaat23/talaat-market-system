import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface CycleCount {
  id: string;
  type: 'blind' | 'guided' | 'investigation';
  status: 'draft' | 'pending_approval' | 'posting' | 'posted' | 'cancelled';
  created_by: number;
  assigned_to: number | null;
  approved_by: number | null;
  total_variance_value: string;
  location: string | null;
  idempotency_key: string | null;
  posting_snapshot: any;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  items?: CycleCountItem[];
}

export interface CycleCountItem {
  id: string;
  cycle_count_id: string;
  product_id: number;
  product_name?: string;
  barcode?: string;
  location: string | null;
  system_qty: string;
  counted_qty: string;
  variance: string;
  unit_cost: string | null;
  final_variance_cost: string | null;
  snapshot_timestamp: string;
  recount_level: 'first' | 'second' | 'final';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCycleCounts(status?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['cycle-counts', { status, page, limit }],
    queryFn: async () => {
      const res = await apiClient.get('/cycle-counts', { params: { status, page, limit } });
      return res.data;
    },
  });
}

export function useCycleCount(id: string) {
  return useQuery({
    queryKey: ['cycle-counts', id],
    queryFn: async () => {
      const res = await apiClient.get(`/cycle-counts/${id}`);
      return res.data.data as CycleCount;
    },
    enabled: !!id,
  });
}

export function useCreateCycleCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; location?: string }) => {
      const res = await apiClient.post('/cycle-counts', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
  });
}

export function useUpdateCycleCountItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { cycle_count_id: string; product_id: number; counted_qty: number; location?: string; notes?: string }) => {
      const res = await apiClient.put(`/cycle-counts/${data.cycle_count_id}/items`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts', variables.cycle_count_id] });
    },
  });
}

export function useScanCycleCountItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { cycle_count_id: string; barcode: string }) => {
      const res = await apiClient.post(`/cycle-counts/${data.cycle_count_id}/scan`, { barcode: data.barcode });
      return res.data;
    },
    onSuccess: (_, variables) => {
      // Optimistic update could go here, but since the scanner is fast and backend is atomic,
      // invalidating is safe. For immediate UI feedback, we can optimistically update the cache.
      // But invalidation ensures 100% sync.
      queryClient.invalidateQueries({ queryKey: ['cycle-counts', variables.cycle_count_id] });
    },
  });
}

export function usePostCycleCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { cycle_count_id: string; idempotency_key: string; manager_id?: number; pin?: string }) => {
      const res = await apiClient.post(`/cycle-counts/${data.cycle_count_id}/post`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelCycleCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/cycle-counts/${id}/cancel`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
  });
}
