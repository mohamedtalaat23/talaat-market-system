import { useState, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { useEmployees, type Employee } from './hooks/useEmployeeQueries';
import { EmployeeModal } from './components/EmployeeModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { EmployeeFilterBar } from './components/EmployeeFilterBar';
import { EmployeeGrid } from './components/EmployeeGrid';
import { Pagination } from '@/components/ui/Pagination';
import { useModalStore } from '@/stores/modalStore';
import { useTranslation } from '@/hooks/useTranslation';

type EmployeeRole = 'admin' | 'manager' | 'cashier';

/**
 * Employees Access Directory orchestrator.
 * Keeps directory search, grids, pagination, and overlay triggers clean and maintainable.
 */
export function EmployeesPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedRole, setSelectedRole] = useState<EmployeeRole | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<boolean | null>(null); // true = Active, false = Inactive, null = All
  const [searchTerm, setSearchTerm] = useState('');

  const openModal = useModalStore((state) => state.openModal);

  // Memoize filters to stabilize reference and prevent infinite render loops
  const queryFilters = useMemo(
    () => ({
      page,
      limit,
      role: selectedRole,
      is_active: selectedStatus,
    }),
    [page, limit, selectedRole, selectedStatus],
  );

  // Fetch employees data list via custom hooks
  const { data: employeesData, isLoading, error, refetch } = useEmployees(queryFilters);

  const allEmployees = employeesData?.data || [];
  const meta = employeesData?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  // Client-side search filters for name or username (keeps typing extremely snappy)
  const filteredEmployees = allEmployees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return emp.full_name.toLowerCase().includes(term) || emp.username.toLowerCase().includes(term);
  });

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRole(null);
    setSelectedStatus(null);
    setPage(1);
  };

  const openCreateModal = () => {
    openModal('employee_form', { mode: 'create', employee: undefined });
  };

  const openEditModal = (emp: Employee) => {
    openModal('employee_form', { mode: 'edit', employee: emp });
  };

  const openDeleteDialog = (emp: Employee) => {
    openModal('employee_delete', emp);
  };

  return (
    <PageContainer
      title={t('employees.title')}
      description={t('employees.description')}
      loading={isLoading && page === 1}
      error={error as Error}
      refetch={refetch}
      actions={
        <Button onClick={openCreateModal} className="flex items-center gap-2 font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all rounded-xl px-5 py-5">
          <div className="bg-white/20 p-1 rounded-md">
            <Plus size={16} className="text-white" />
          </div>
          <span className="tracking-wide">{t('employees.registerStaff')}</span>
        </Button>
      }
    >
      {/* Search and filters bar */}
      <EmployeeFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedRole={selectedRole}
        onSelectRole={(role) => {
          setSelectedRole(role);
          setPage(1);
        }}
        selectedStatus={selectedStatus}
        onSelectStatus={(status) => {
          setSelectedStatus(status);
          setPage(1);
        }}
        onClearFilters={handleClearFilters}
      />

      {/* Staff lists card grids */}
      {isLoading && page === 1 ? (
        <div className="flex h-40 w-full items-center justify-center rounded-lg border border-border bg-neutral-900/10">
          <span className="text-sm text-secondary font-mono">{t('common.loading')}</span>
        </div>
      ) : (
        <EmployeeGrid
          employees={filteredEmployees}
          onEdit={openEditModal}
          onDelete={openDeleteDialog}
          onClearFilters={handleClearFilters}
          hasFilters={Boolean(searchTerm || selectedRole !== null || selectedStatus !== null)}
        />
      )}

      {/* Unified Pagination footer component */}
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        limit={meta.limit}
        onPageChange={setPage}
        itemName="accounts"
      />

      {/* Centralized modal overlays */}
      <EmployeeModal />
      <DeleteConfirmDialog />
    </PageContainer>
  );
}
export default EmployeesPage;
