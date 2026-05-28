import React from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface PageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: Error | null;
  refetch?: () => void;
  children: React.ReactNode;
}

export function PageContainer({
  title,
  description,
  actions,
  loading = false,
  error = null,
  refetch,
  children,
}: PageContainerProps) {
  return (
    <div className="flex flex-col space-y-6 w-full max-w-[var(--content-max-width)] mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-neutral-400 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center space-x-3">{actions}</div>}
      </div>

      {/* Main Content Pane */}
      <div className="min-h-[400px] w-full relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/20 backdrop-blur-[1px] rounded-lg">
            <Spinner size="md" />
            <span className="mt-3 text-sm text-neutral-400">Loading data...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center p-8 border border-destructive/20 rounded-lg bg-destructive/5 max-w-md mx-auto my-12">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-base font-semibold text-foreground">Failed to Load Information</h3>
            <p className="text-sm text-neutral-400 mt-2 mb-4 leading-relaxed">
              {error.message || 'An error occurred while fetching information from the server.'}
            </p>
            {refetch && (
              <Button onClick={refetch} variant="outline" size="sm">
                Try Again
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
