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
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        variant === 'primary' && 'bg-chrome-accent text-black hover:bg-violet-300',
        variant === 'default' &&
          'bg-chrome-surface text-chrome-fg border border-chrome-border hover:bg-[#1d1d24]',
        variant === 'ghost' && 'text-chrome-muted hover:text-chrome-fg hover:bg-chrome-surface',
        className,
      )}
    >
      {children}
    </button>
  );
});
