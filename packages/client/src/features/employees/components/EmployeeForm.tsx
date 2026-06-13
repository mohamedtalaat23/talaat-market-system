import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { User, Lock, Shield, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import type { Employee } from '../hooks/useEmployeeQueries';
import { useTranslation } from '@/hooks/useTranslation';

interface EmployeeFormProps {
  initialData?: Employee | undefined;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
}

export function EmployeeForm({
  initialData,
  onSubmit,
  isLoading,
  mode,
  onCancel,
}: EmployeeFormProps) {
  const { t } = useTranslation();
  // Input fields
  const [fullName, setFullName] = useState(initialData?.full_name || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [role, setRole] = useState<'admin' | 'manager' | 'cashier'>(initialData?.role || 'cashier');
  const [isActive, setIsActive] = useState<boolean>(initialData ? initialData.is_active : true);

  // Credentials states - isolated to this component form only, never preloaded
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Standard local validations
    if (!fullName.trim()) {
      setFormError(t('employees.nameRequired'));
      return;
    }

    if (!username.trim() || username.length < 3) {
      setFormError(t('employees.usernameMin'));
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setFormError(t('employees.usernameInvalid'));
      return;
    }

    // Password validations (required on create, optional on update)
    if (mode === 'create' && (!password || password.length < 6)) {
      setFormError(t('employees.passwordRequired'));
      return;
    }
    if (mode === 'edit' && password && password.length < 6) {
      setFormError(t('employees.passwordMin'));
      return;
    }

    // PIN validations (optional, must be 4-6 digits)
    if (pin) {
      const pinRegex = /^\d{4,6}$/;
      if (!pinRegex.test(pin)) {
        setFormError(t('employees.pinInvalid'));
        return;
      }
    }

    const payload: any = {
      full_name: fullName.trim(),
      username: username.trim(),
      role,
      is_active: isActive,
    };

    // Only append credentials if they are provided
    if (password) {
      payload.password = password;
    }
    if (pin) {
      payload.pin = pin;
    } else if (mode === 'edit') {
      // Allow clearing the PIN explicitly
      payload.pin = null;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 select-text">
      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {formError}
        </div>
      )}

      {/* Primary detail inputs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {t('employees.fullName')}
          </label>
          <Input
            id="fullName"
            placeholder="e.g. Saleh Mahmoud"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="empUsername" className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {t('employees.usernameLabel')}
          </label>
          <Input
            id="empUsername"
            placeholder="e.g. cashier_saleh"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="empRole" className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            {t('employees.roleLevel')}
          </label>
          <select
            id="empRole"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            disabled={isLoading}
            className="flex h-10 w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
          >
            <option value="cashier">{t('employees.cashierDesc')}</option>
            <option value="manager">{t('employees.managerDesc')}</option>
            <option value="admin">{t('employees.adminDesc')}</option>
          </select>
        </div>

        {/* Credentials sections - never preloaded, isolated state */}
        <div className="space-y-1.5 pt-2 border-t border-border/40 sm:border-t-0 sm:pt-0">
          <label htmlFor="empPassword" className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            {mode === 'create' ? t('employees.passwordLabel') : t('employees.passwordUpdate')}
          </label>
          <Input
            id="empPassword"
            type="password"
            placeholder={
              mode === 'create'
                ? t('employees.passwordPlaceholder')
                : t('employees.passwordUpdatePlaceholder')
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required={mode === 'create'}
          />
        </div>

        <div className="space-y-1.5 pt-2 border-t border-border/40 sm:border-t-0 sm:pt-0">
          <label htmlFor="empPin" className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            {t('employees.pinLabel')}
          </label>
          <Input
            id="empPin"
            type="password"
            maxLength={6}
            placeholder={t('employees.pinPlaceholder')}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 py-4 mt-2 px-4 rounded-lg bg-card-hover/30 border border-border/40">
        <input
          id="isEmpActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-input-border bg-input-bg text-primary focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
        />
        <label
          htmlFor="isEmpActive"
          className="text-sm font-semibold text-foreground cursor-pointer select-none flex items-center gap-2"
        >
          {isActive ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-secondary" />}
          {t('employees.accountActive')}
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-input-border pt-4 mt-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="font-medium min-w-[90px]" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-1.5">
              <Spinner size="sm" />
              <span>{t('employees.saving')}</span>
            </div>
          ) : (
            <span>{t('employees.saveStaff')}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
export default EmployeeForm;
