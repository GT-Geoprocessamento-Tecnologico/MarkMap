import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  loading?: boolean | undefined;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type, ...rest }, ref) => {
    const isDisabled = loading || disabled === true;

    return (
      <button
        {...rest}
        ref={ref}
        type={type ?? 'button'}
        className={cx(
          'gn-button',
          `gn-button--${variant}`,
          `gn-button--${size}`,
          className,
        )}
        disabled={isDisabled}
        aria-busy={loading}
      >
        {loading ? <span className="gn-button__spinner" aria-hidden="true" /> : null}
        {children}
      </button>
    );
  },
);
