import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface ShiftVarianceReport {
  id: number;
  cashier_name: string | null;
  register_name: string | null;
  start_time: string;
  end_time: string | null;
  starting_cash: number;
  expected_cash: number | null;
  ending_cash: number | null;
  variance: number | null;
  notes: string | null;
}

export interface ShiftDetailTransaction {
  id: number;
  receipt_number: string;
  total: number;
  payment_method: 'cash' | 'card' | 'split';
  discount_amount: number;
  global_discount: number;
  cash_received: number | null;
  change_given: number;
  status: 'completed' | 'voided';
  print_count: number;
  created_at: string;
  cashier_name: string | null;
}

export interface ShiftDetailOverride {
  id: number;
  action_type: string;
  reference_id: string | null;
  details: string | null;
  manager_name: string | null;
  created_at: string;
}

export interface ShiftDetailResponse {
  shift: ShiftVarianceReport;
  transactions: ShiftDetailTransaction[];
  overrides: ShiftDetailOverride[];
  summary: {
    transaction_count: number;
    total_revenue: number;
    total_discounts: number;
    cash_sales_total: number;
    card_sales_total: number;
  };
}

export interface WeeklyReportDay {
  date: string;
  transaction_count: number;
  total_revenue: number;
  total_discounts: number;
  net_revenue: number;
}

export interface TopProduct {
  product_name: string;
  total_quantity_sold: number;
  total_revenue: number;
}

export interface WeeklyReportResponse {
  days: WeeklyReportDay[];
  totals: {
    transaction_count: number;
    total_revenue: number;
    total_discounts: number;
    net_revenue: number;
  };
  top_products: TopProduct[];
}

export interface OverrideAuditItem {
  id: number;
  action_type: string;
  reference_id: string | null;
  details: string | null;
  created_at: string;
  manager_name: string | null;
  cashier_name: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function useShiftsList(filters: { page: number; limit: number; cashier_id?: number }) {
  return useQuery<PaginatedResponse<ShiftVarianceReport>>({
    queryKey: ['reports', 'shifts', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/shifts', { params: filters });
      return data;
    },
  });
}

export function useShiftDetail(id: number | undefined) {
  return useQuery<{ success: boolean; data: ShiftDetailResponse }>({
    queryKey: ['reports', 'shifts', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/reports/shifts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useWeeklyReport(weekStart?: string, weekEnd?: string) {
  return useQuery<{ success: boolean; data: WeeklyReportResponse }>({
    queryKey: ['reports', 'weekly', weekStart, weekEnd],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (weekStart) params.week_start = weekStart;
      if (weekEnd) params.week_end = weekEnd;
      
      const { data } = await apiClient.get('/reports/weekly', { params });
      return data;
    },
    enabled: !!weekStart && !!weekEnd,
  });
}

export function useOverridesList(filters: { page: number; limit: number; date_from?: string; date_to?: string }) {
  return useQuery<PaginatedResponse<OverrideAuditItem>>({
    queryKey: ['reports', 'overrides', filters],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports/overrides', { params: filters });
      return data;
    },
  });
}
