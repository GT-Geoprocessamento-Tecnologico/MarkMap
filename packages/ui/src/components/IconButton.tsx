import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export type IconButtonVariant = 'ghost' | 'secondary';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: IconButtonVariant | undefined;
  children: ReactNode;
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  children,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      className={cx('gn-icon-button', `gn-icon-button--${variant}`, className)}
      aria-label={label}
    >
      {children}
    </button>
  );
}
