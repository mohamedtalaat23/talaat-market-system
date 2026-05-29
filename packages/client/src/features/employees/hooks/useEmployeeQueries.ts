import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface Employee {
  id: number;
  full_name: string;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeFilters {
  page: number;
  limit: number;
  role?: 'admin' | 'manager' | 'cashier' | null;
  is_active?: boolean | null;
  search?: string; // Client-side search matching local results
}

export interface EmployeesResponse {
  success: boolean;
  data: Employee[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateEmployeeInput {
  full_name: string;
  username: string;
  password: string;
  pin?: string | null;
  role: 'admin' | 'manager' | 'cashier';
  is_active: boolean;
}

export interface UpdateEmployeeInput {
  full_name?: string;
  username?: string;
  password?: string;
  pin?: string | null;
  role?: 'admin' | 'manager' | 'cashier';
  is_active?: boolean;
}

/**
 * Hook to retrieve paginated list of employees.
 */
export function useEmployees(filters: Omit<EmployeeFilters, 'search'>) {
  return useQuery<EmployeesResponse>({
    queryKey: ['employees', filters],
    queryFn: async () => {
      const params: Record<string, any> = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.role) {
        params.role = filters.role;
      }

      if (filters.is_active !== null && filters.is_active !== undefined) {
        params.is_active = filters.is_active ? 'true' : 'false';
      }

      const response = await apiClient.get<EmployeesResponse>('/employees', { params });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to create a new employee.
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<Employee, Error, CreateEmployeeInput>({
    mutationFn: async (input) => {
      const response = await apiClient.post<{ success: boolean; data: Employee }>('/employees', input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/**
 * Hook to update an existing employee.
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<Employee, Error, { id: number; data: UpdateEmployeeInput }>({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put<{ success: boolean; data: Employee }>(`/employees/${id}`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/**
 * Hook to soft-delete an employee.
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/**
 * Hook to retrieve active managers and admins.
 */
export function useManagers() {
  return useQuery<Employee[]>({
    queryKey: ['active-managers'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Employee[] }>('/employees/managers');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes stale time is completely safe since manager configurations are static
  });
}
