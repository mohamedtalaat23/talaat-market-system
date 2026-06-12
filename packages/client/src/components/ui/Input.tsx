import * as React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input-border bg-input-bg px-3 py-2 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-input-focus disabled:bg-neutral-100 disabled:cursor-not-allowed transition-all',
          error && 'border-destructive focus:ring-destructive focus:border-transparent',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
