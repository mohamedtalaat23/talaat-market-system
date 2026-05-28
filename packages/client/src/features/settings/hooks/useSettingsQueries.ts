import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import toast from 'react-hot-toast';

export interface AppSettings {
  store_name?: string;
  currency_symbol?: string;
  tax_rate?: number;
  receipt_header_text?: string;
  receipt_footer_text?: string;
  auto_print?: boolean;
  [key: string]: any;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ status: string; data: AppSettings }>('/settings');
      return data.data;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<AppSettings>) => {
      const { data } = await apiClient.put<{ status: string; data: AppSettings }>('/settings', payload);
      return data.data;
    },
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(['settings'], updatedSettings);
      toast.success('Settings updated successfully');
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });
}
