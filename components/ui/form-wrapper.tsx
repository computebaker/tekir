import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  isLoading?: boolean;
  disabled?: boolean;
  successMessage?: string;
  error?: string | null;
}

export function Form({
  children,
  isLoading = false,
  disabled = false,
  successMessage,
  error,
  className,
  onSubmit,
  ...props
}: FormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && !disabled && onSubmit) {
      onSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, {
            disabled: disabled || isLoading,
          });
        }
        return child;
      })}

      {successMessage && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
    </form>
  );
}

export interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, required, description, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-xs text-destructive font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
