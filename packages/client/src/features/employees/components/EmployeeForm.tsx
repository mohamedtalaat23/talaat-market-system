import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import type { Employee } from '../hooks/useEmployeeQueries';

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
      setFormError('Full name is required');
      return;
    }

    if (!username.trim() || username.length < 3) {
      setFormError('Username must be at least 3 characters');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setFormError('Username can only contain letters, numbers, and underscores');
      return;
    }

    // Password validations (required on create, optional on update)
    if (mode === 'create' && (!password || password.length < 6)) {
      setFormError('Password is required and must be at least 6 characters');
      return;
    }
    if (mode === 'edit' && password && password.length < 6) {
      setFormError('Updated password must be at least 6 characters');
      return;
    }

    // PIN validations (optional, must be 4-6 digits)
    if (pin) {
      const pinRegex = /^\d{4,6}$/;
      if (!pinRegex.test(pin)) {
        setFormError('Quick login PIN must be between 4 and 6 numeric digits');
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
        <div className="space-y-1">
          <label htmlFor="fullName" className="text-xs font-semibold text-neutral-300">
            Full Name *
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

        <div className="space-y-1">
          <label htmlFor="empUsername" className="text-xs font-semibold text-neutral-300">
            System Username *
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

        <div className="space-y-1">
          <label htmlFor="empRole" className="text-xs font-semibold text-neutral-300">
            Access Role Level
          </label>
          <select
            id="empRole"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            disabled={isLoading}
            className="flex h-10 w-full rounded-md border border-border bg-neutral-900/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="cashier">Cashier (Standard POS checkout rights)</option>
            <option value="manager">Manager (Adjusts inventory & products)</option>
            <option value="admin">Administrator (Full ERP access controls)</option>
          </select>
        </div>

        {/* Credentials sections - never preloaded, isolated state */}
        <div className="space-y-1">
          <label htmlFor="empPassword" className="text-xs font-semibold text-neutral-300">
            {mode === 'create' ? 'Password *' : 'Update Password (Optional)'}
          </label>
          <Input
            id="empPassword"
            type="password"
            placeholder={mode === 'create' ? 'Min. 6 characters' : 'Enter only to change password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required={mode === 'create'}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="empPin" className="text-xs font-semibold text-neutral-300">
            Quick-Login PIN Code (Optional)
          </label>
          <Input
            id="empPin"
            type="password"
            maxLength={6}
            placeholder="4 - 6 digits only"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 py-2">
        <input
          id="isEmpActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={isLoading}
          className="h-4 w-4 rounded border-border bg-neutral-800 text-primary focus:ring-primary focus:ring-offset-0"
        />
        <label htmlFor="isEmpActive" className="text-sm font-semibold text-neutral-200 cursor-pointer">
          Account Active (Allows ERP / POS authentication)
        </label>
      </div>

      <div className="flex justify-end space-x-2 border-t border-border pt-4 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="font-medium min-w-[90px]"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center space-x-1.5">
              <Spinner size="sm" />
              <span>Saving...</span>
            </div>
          ) : (
            <span>Save Staff</span>
          )}
        </Button>
      </div>
    </form>
  );
}
export default EmployeeForm;
