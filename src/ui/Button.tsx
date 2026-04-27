import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'default', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-150',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-chrome-accent focus-visible:ring-offset-1 focus-visible:ring-offset-chrome-bg',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        variant === 'primary' && 'bg-chrome-accent text-chrome-bg hover:bg-chrome-accent-soft',
        variant === 'default' &&
          'bg-chrome-surface text-chrome-fg border border-chrome-border hover:bg-chrome-surface-hover hover:border-chrome-border-strong',
        variant === 'ghost' && 'text-chrome-muted hover:text-chrome-fg hover:bg-chrome-surface',
        className,
      )}
    >
      {children}
    </button>
  );
});
