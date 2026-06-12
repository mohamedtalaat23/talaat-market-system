import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useManagers } from '@/features/employees/hooks/useEmployeeQueries';

interface InlineManagerApprovalProps {
  managerId: number | '';
  setManagerId: (id: number | '') => void;
  pin: string;
  setPin: (pin: string) => void;
  isSubmitting: boolean;
  contextMetadata?: React.ReactNode;
}

export function InlineManagerApproval({
  managerId,
  setManagerId,
  pin,
  setPin,
  isSubmitting,
  contextMetadata,
}: InlineManagerApprovalProps) {
  const { data: managers = [] } = useManagers();

  useEffect(() => {
    if (managers.length > 0 && managerId === '') {
      const firstManager = managers[0];
      if (firstManager) {
        setManagerId(firstManager.id);
      }
    }
  }, [managers, managerId, setManagerId]);

  return (
    <div className="bg-popover border border-danger/30 rounded-lg p-4 space-y-3 mt-4">
      <div className="flex items-center space-x-3 mb-2 pb-2 border-b border-input-border">
        <ShieldAlert className="w-5 h-5 text-danger" />
        <h4 className="font-bold text-input-text">Manager Approval Required</h4>
      </div>
      
      {contextMetadata && (
        <div className="mb-4 text-sm bg-danger/5 border border-danger/20 rounded p-3 text-input-text">
          <div className="font-mono text-xs text-secondary mb-1">Authorizing:</div>
          {contextMetadata}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {managers.length > 0 && (
          <div>
            <label htmlFor="inline-manager-select" className="block text-xs font-semibold text-secondary mb-1">
              Manager
            </label>
            <select
              id="inline-manager-select"
              disabled={isSubmitting}
              className="w-full bg-input-bg border border-input-border rounded p-2 text-input-text focus:outline-none focus:border-input-focus text-sm font-semibold"
              value={managerId}
              onChange={(e) => setManagerId(Number(e.target.value))}
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="inline-pin-input" className="block text-xs font-semibold text-secondary mb-1">
            PIN
          </label>
          <input
            id="inline-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            disabled={isSubmitting}
            className="w-full bg-input-bg border border-input-border rounded p-2 text-center text-input-text tracking-[0.5em] focus:outline-none focus:border-input-focus focus:ring-1 focus:ring-primary/20"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
        </div>
      </div>
    </div>
  );
}
