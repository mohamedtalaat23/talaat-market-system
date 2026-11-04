import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
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
  const { language } = useTranslation();
  const ar = language === 'ar';
  return (
    <div className="flex flex-col space-y-5 w-full animate-fade-in">
      {/* Page Subheader — description + actions only. Title lives in topbar. */}
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="retail-page-title">{title}</h1>
            {description && <p className="text-sm text-secondary mt-2">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Main Content Pane */}
      <div className="min-h-[400px] w-full relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-lg">
            <Spinner size="md" />
            <span className="mt-3 text-sm text-secondary">
              {ar ? 'جارٍ تحميل البيانات…' : 'Loading data…'}
            </span>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center text-center p-8 border border-destructive/20 rounded-lg bg-destructive/5 max-w-md mx-auto my-12"
          >
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              {ar ? 'تعذر تحميل البيانات' : 'Unable to load information'}
            </h3>
            <p className="text-sm text-secondary mt-2 mb-4 leading-relaxed">
              {error.message || 'An error occurred while fetching information from the server.'}
            </p>
            {refetch && (
              <Button onClick={refetch} variant="outline" size="sm">
                {ar ? 'إعادة المحاولة' : 'Try again'}
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
