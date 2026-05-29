import {
  useGenericListQuery,
  useGenericDetailQuery,
  useGenericCreateMutation,
  useGenericUpdateMutation,
  useGenericDeleteMutation,
} from '@/hooks/useGenericCrud';

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

/**
 * Fetch paginated list of suppliers using the generic list query.
 */
export function useSuppliers(search?: string, page = 1, limit = 10) {
  const filters: Record<string, any> = { page, limit };
  if (search) {
    filters.search = search;
  }
  return useGenericListQuery<Supplier, Record<string, any>>('suppliers', '/suppliers', filters);
}

/**
 * Fetch detailed supplier profile using the generic detail query.
 */
export function useSupplierDetail(id: number) {
  return useGenericDetailQuery<SupplierDetail>('supplier', '/suppliers', id);
}

/**
 * Register a new supplier using the generic create mutation.
 */
export function useCreateSupplier() {
  return useGenericCreateMutation<CreateSupplierPayload, Supplier>(
    'suppliers',
    '/suppliers',
    'Supplier profile registered'
  );
}

/**
 * Update an existing supplier using the generic update mutation.
 * Adapts call properties for drop-in signature backward compatibility.
 */
export function useUpdateSupplier(id: number) {
  const mutation = useGenericUpdateMutation<UpdateSupplierPayload, Supplier>(
    'suppliers',
    '/suppliers',
    'Supplier profile updated'
  );

  return {
    ...mutation,
    mutate: (payload: UpdateSupplierPayload, options?: any) =>
      mutation.mutate({ id, payload }, options),
    mutateAsync: (payload: UpdateSupplierPayload, options?: any) =>
      mutation.mutateAsync({ id, payload }, options),
  };
}

/**
 * Soft delete a supplier using the generic delete mutation.
 */
export function useDeleteSupplier() {
  return useGenericDeleteMutation('suppliers', '/suppliers', 'Supplier profile deleted successfully');
}
